import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { generateCards } from "@/lib/generate-cards";
import { getSituationsForAnchor, grammarAnchorForTopic } from "@/lib/situation-shortlists";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { CEFR_LEVELS, type CEFRLevel } from "@/types";

export const runtime = "nodejs";

const SKELETON_MODEL = "claude-haiku-4-5-20251001";
const SKELETON_MAX_TOKENS = 1500;

const SITUATION_SYSTEM_PROMPT =
  "You are a personalised language curriculum designer. For each grammar anchor, you select the single most relevant real-life situation from a pre-approved shortlist. Your selection is guided by the learner's goal and interests. Always select from the provided shortlist — never invent new situations.";

const UNIT_LESSON_DEFS = [
  { type: "vocabulary" as const, title: "Vocabulary", order_index: 0 },
  { type: "grammar" as const, title: "Grammar", order_index: 1 },
  { type: "reading" as const, title: "Reading", order_index: 2 },
  { type: "review" as const, title: "Review", order_index: 3 }
];

type CurriculumTopicRow = {
  topic_key: string;
  topic_name: string;
  description: string | null;
  order_index: number;
  cefr_level: CEFRLevel;
};

function sliceJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) {
    throw new Error("No JSON object found in model response");
  }
  return text
    .slice(first, last + 1)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function normalizeCefrLevel(value: unknown): CEFRLevel | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return (CEFR_LEVELS as readonly string[]).includes(normalized) ? (normalized as CEFRLevel) : null;
}

/** Promote weak-area topics earlier while preserving spine order within each group. */
function buildUnitOrder(topics: CurriculumTopicRow[], weakAreas: string[]): CurriculumTopicRow[] {
  const ordered = [...topics].sort((a, b) => a.order_index - b.order_index);
  const weakSet = new Set(weakAreas.map((w) => w.trim()).filter(Boolean));
  const weak = ordered.filter((t) => weakSet.has(t.topic_key));
  const rest = ordered.filter((t) => !weakSet.has(t.topic_key));
  return [...weak, ...rest];
}

function buildSituationUserPrompt(params: {
  goal: string | null;
  interests: string[];
  knownLanguagesSummary: string;
  unitsForPrompt: {
    topic_key: string;
    topic_name: string;
    grammar_anchor: string;
    shortlist: string[];
  }[];
}): string {
  const unitsJson = JSON.stringify(
    params.unitsForPrompt.map((t) => ({
      topic_key: t.topic_key,
      topic_name: t.topic_name,
      grammar_anchor: t.grammar_anchor,
      shortlist: t.shortlist
    }))
  );

  return `Learner profile:
- Goal for this language: ${params.goal ?? "(not set)"}
- Personal interests: ${params.interests.length ? params.interests.join(", ") : "(none)"}
- Known languages: ${params.knownLanguagesSummary}

For each unit below, select the single best situation from its shortlist.
Return ONLY valid JSON: { "units": [{ "topic_key": string, "selected_situation": string }] }

Units:
${unitsJson}`;
}

async function selectSituationsWithAi(params: {
  goal: string | null;
  interests: string[];
  knownLanguagesSummary: string;
  orderedTopics: CurriculumTopicRow[];
  language_code: string;
  cefr_level: CEFRLevel;
}): Promise<Map<string, string> | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  const unitsForPrompt = params.orderedTopics
    .map((t) => {
      const grammar_anchor = grammarAnchorForTopic(t.topic_key);
      const shortlist = getSituationsForAnchor(
        grammar_anchor,
        params.cefr_level,
        params.language_code
      );
      console.log(
        `[course/skeleton] getSituationsForAnchor topic_key=${t.topic_key} grammar_anchor=${grammar_anchor} cefr=${params.cefr_level} lang=${params.language_code} shortlist=${JSON.stringify(shortlist)}`
      );
      return {
        topic_key: t.topic_key,
        topic_name: t.topic_name,
        grammar_anchor,
        shortlist
      };
    })
    .filter((t) => t.shortlist.length > 0);

  if (unitsForPrompt.length === 0) {
    return new Map();
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userPrompt = buildSituationUserPrompt({
    goal: params.goal,
    interests: params.interests,
    knownLanguagesSummary: params.knownLanguagesSummary,
    unitsForPrompt
  });

  try {
    const message = await client.messages.create({
      model: SKELETON_MODEL,
      max_tokens: SKELETON_MAX_TOKENS,
      system: SITUATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text : "";
    if (!text.trim()) {
      return null;
    }

    const parsed = JSON.parse(sliceJsonObject(text)) as {
      units?: { topic_key?: string; selected_situation?: string }[];
    };

    if (!Array.isArray(parsed.units)) {
      return null;
    }

    const shortlistByKey = new Map(unitsForPrompt.map((u) => [u.topic_key, u.shortlist]));
    const selections = new Map<string, string>();

    for (const row of parsed.units) {
      const key = typeof row.topic_key === "string" ? row.topic_key.trim() : "";
      const situation =
        typeof row.selected_situation === "string" ? row.selected_situation.trim() : "";
      const shortlist = shortlistByKey.get(key);
      if (!key || !situation || !shortlist?.includes(situation)) {
        continue;
      }
      selections.set(key, situation);
      console.log(`[course/skeleton] AI selected situation topic_key=${key} situation=${situation}`);
    }

    return selections;
  } catch (e) {
    console.error("[course/skeleton] Anthropic:", e);
    return null;
  }
}

/**
 * Deletes a course's dependent rows child-first (flashcards / sentence_cards →
 * lessons → units) — the schema has no FK cascades, so deleting units or the
 * course directly fails while children exist.
 */
async function cleanupCourseTree(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  course_id: string,
  opts: { deleteCourse: boolean }
): Promise<void> {
  const { data: unitRows, error: unitsSelErr } = await adminClient
    .from("units")
    .select("id")
    .eq("course_id", course_id);
  if (unitsSelErr) throw new Error(unitsSelErr.message);

  const unitIds = (unitRows ?? []).map((u) => u.id as string);

  if (unitIds.length > 0) {
    const { data: lessonRows, error: lessonsSelErr } = await adminClient
      .from("lessons")
      .select("id")
      .in("unit_id", unitIds);
    if (lessonsSelErr) throw new Error(lessonsSelErr.message);

    const lessonIds = (lessonRows ?? []).map((l) => l.id as string);

    if (lessonIds.length > 0) {
      const { data: cardRows, error: cardsSelErr } = await adminClient
        .from("sentence_cards")
        .select("id")
        .in("lesson_id", lessonIds);
      if (cardsSelErr) throw new Error(cardsSelErr.message);

      const cardIds = (cardRows ?? []).map((c) => c.id as string);

      if (cardIds.length > 0) {
        const { error: fcBySentenceErr } = await adminClient
          .from("flashcards")
          .delete()
          .in("sentence_card_id", cardIds);
        if (fcBySentenceErr) throw new Error(fcBySentenceErr.message);
      }

      const { error: fcByLessonErr } = await adminClient
        .from("flashcards")
        .delete()
        .in("lesson_id", lessonIds);
      if (fcByLessonErr) throw new Error(fcByLessonErr.message);

      const { error: cardsDelErr } = await adminClient
        .from("sentence_cards")
        .delete()
        .in("lesson_id", lessonIds);
      if (cardsDelErr) throw new Error(cardsDelErr.message);

      const { error: lessonsDelErr } = await adminClient
        .from("lessons")
        .delete()
        .in("unit_id", unitIds);
      if (lessonsDelErr) throw new Error(lessonsDelErr.message);
    }

    const { error: unitsDelErr } = await adminClient
      .from("units")
      .delete()
      .eq("course_id", course_id);
    if (unitsDelErr) throw new Error(unitsDelErr.message);
  }

  if (opts.deleteCourse) {
    const { error: courseDelErr } = await adminClient
      .from("courses")
      .delete()
      .eq("id", course_id);
    if (courseDelErr) throw new Error(courseDelErr.message);
  }
}

async function deleteFailedCourse(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  course_id: string
): Promise<void> {
  try {
    await cleanupCourseTree(adminClient, course_id, { deleteCourse: true });
  } catch (e) {
    console.error("[course/skeleton] failed-course cleanup:", e);
  }
}

function resolveSituationContext(
  topic: CurriculumTopicRow,
  cefr_level: CEFRLevel,
  language_code: string,
  aiSelections: Map<string, string> | null
): string | null {
  const grammar_anchor = grammarAnchorForTopic(topic.topic_key);
  const shortlist = getSituationsForAnchor(grammar_anchor, cefr_level, language_code);
  if (shortlist.length === 0) {
    console.warn(
      `[course/skeleton] no shortlist for topic_key=${topic.topic_key} grammar_anchor=${grammar_anchor}`
    );
    return null;
  }

  const fromAi = aiSelections?.get(topic.topic_key);
  if (fromAi && shortlist.includes(fromAi)) {
    return fromAi;
  }

  return shortlist[0];
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const language_code =
    typeof raw.language_code === "string" ? raw.language_code.toLowerCase().trim() : "";
  if (!language_code) {
    return NextResponse.json({ error: "Invalid body: require language_code." }, { status: 400 });
  }

  const [
    { data: learningRow, error: learningErr },
    { data: profileRow, error: profileErr },
    { data: knownRows, error: knownErr },
    { data: placementRow, error: placementErr }
  ] = await Promise.all([
    supabase
      .from("learning_languages")
      .select("cefr_level, goal, placement_completed")
      .eq("user_id", user.id)
      .eq("language_code", language_code)
      .maybeSingle(),
    supabase.from("profiles").select("interests").eq("id", user.id).maybeSingle(),
    supabase
      .from("known_languages")
      .select("language_code, language_name, proficiency")
      .eq("user_id", user.id),
    supabase
      .from("placements")
      .select("weak_areas")
      .eq("user_id", user.id)
      .eq("language_code", language_code)
      .maybeSingle()
  ]);

  if (learningErr) {
    console.error("[course/skeleton] learning_languages:", learningErr);
    return NextResponse.json({ error: learningErr.message }, { status: 500 });
  }
  if (profileErr) {
    console.error("[course/skeleton] profiles:", profileErr);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }
  if (knownErr) {
    console.error("[course/skeleton] known_languages:", knownErr);
    return NextResponse.json({ error: knownErr.message }, { status: 500 });
  }
  if (placementErr) {
    console.error("[course/skeleton] placements:", placementErr);
    return NextResponse.json({ error: placementErr.message }, { status: 500 });
  }

  const cefr_level = normalizeCefrLevel(learningRow?.cefr_level);
  if (!learningRow || !cefr_level) {
    return NextResponse.json(
      { error: "Add this language under learning languages before generating a course." },
      { status: 400 }
    );
  }

  const interests = Array.isArray(profileRow?.interests)
    ? (profileRow.interests as string[]).filter((i) => typeof i === "string")
    : [];
  const goal = typeof learningRow.goal === "string" ? learningRow.goal : null;
  const weak_areas = Array.isArray(placementRow?.weak_areas)
    ? (placementRow.weak_areas as string[])
    : [];

  const knownLanguagesSummary =
    (knownRows ?? []).length === 0
      ? "(none listed)"
      : (knownRows ?? [])
          .map((k) => `${k.language_name} ${k.proficiency ?? ""}`.trim())
          .join(", ");

  let adminClient;
  try {
    adminClient = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[course/skeleton] service role client:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: topicRows, error: topicsErr } = await adminClient
    .from("curriculum_topics")
    .select("topic_key, topic_name, description, order_index, cefr_level")
    .eq("language_code", language_code)
    .eq("cefr_level", cefr_level)
    .order("order_index", { ascending: true });

  if (topicsErr) {
    console.error("[course/skeleton] curriculum_topics:", topicsErr);
    return NextResponse.json({ error: topicsErr.message }, { status: 500 });
  }
  if (!topicRows?.length) {
    return NextResponse.json(
      {
        error: `No curriculum topics found for ${language_code} at ${cefr_level}. Seed curriculum first.`
      },
      { status: 400 }
    );
  }

  const curriculumTopics = topicRows as CurriculumTopicRow[];
  const orderedTopics = buildUnitOrder(curriculumTopics, weak_areas);

  const aiSelections = await selectSituationsWithAi({
    goal,
    interests,
    knownLanguagesSummary,
    orderedTopics,
    language_code,
    cefr_level
  });

  const { data: courseRow, error: courseErr } = await supabase
    .from("courses")
    .upsert(
      {
        user_id: user.id,
        language_code,
        cefr_level,
        generated_at: new Date().toISOString()
      },
      { onConflict: "user_id,language_code" }
    )
    .select("id")
    .single();

  if (courseErr || !courseRow?.id) {
    console.error("[course/skeleton] courses upsert:", courseErr);
    return NextResponse.json({ error: courseErr?.message ?? "Course upsert failed." }, { status: 500 });
  }

  const course_id = courseRow.id as string;

  try {
    await cleanupCourseTree(adminClient, course_id, { deleteCourse: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[course/skeleton] existing course cleanup:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const unitInsertRows = orderedTopics.map((topic, i) => {
    const grammar_anchor = grammarAnchorForTopic(topic.topic_key);
    const situation_context = resolveSituationContext(
      topic,
      cefr_level,
      language_code,
      aiSelections
    );
    console.log(
      `[course/skeleton] unit insert topic_key=${topic.topic_key} grammar_anchor=${grammar_anchor} situation_context=${situation_context ?? "NULL"}`
    );
    return {
      course_id,
      topic_key: topic.topic_key,
      title: topic.topic_name,
      description: topic.description ?? null,
      cefr_level,
      order_index: i,
      grammar_anchor,
      situation_context,
      status: i === 0 ? ("available" as const) : ("locked" as const),
      unlocked_at: i === 0 ? now : null,
      cards_generated: false
    };
  });

  const { data: insertedUnits, error: unitsInsErr } = await adminClient
    .from("units")
    .insert(unitInsertRows)
    .select("id, order_index");

  if (unitsInsErr || !insertedUnits?.length) {
    console.error("[course/skeleton] units insert:", unitsInsErr);
    await deleteFailedCourse(adminClient, course_id);
    return NextResponse.json({ error: unitsInsErr?.message ?? "Unit insert failed." }, { status: 500 });
  }

  const sortedInsertedUnits = insertedUnits
    .slice()
    .sort((a, b) => (a.order_index as number) - (b.order_index as number));

  const firstInserted = sortedInsertedUnits[0];
  if (!firstInserted?.id) {
    console.error("[course/skeleton] no id returned for first unit");
    await deleteFailedCourse(adminClient, course_id);
    return NextResponse.json({ error: "Unit insert returned no id." }, { status: 500 });
  }

  for (const unit of sortedInsertedUnits) {
    const isFirstUnit = (unit.order_index as number) === 0;
    const lessonRows = UNIT_LESSON_DEFS.map((def) => ({
      unit_id: unit.id as string,
      type: def.type,
      title: def.title,
      order_index: def.order_index,
      status: isFirstUnit && def.order_index === 0 ? ("available" as const) : ("locked" as const),
      content: {}
    }));

    const { error: lessonsInsErr } = await adminClient.from("lessons").insert(lessonRows);
    if (lessonsInsErr) {
      console.error("[course/skeleton] lessons insert:", lessonsInsErr);
      await deleteFailedCourse(adminClient, course_id);
      return NextResponse.json({ error: lessonsInsErr.message }, { status: 500 });
    }
  }

  const firstUnitMeta = unitInsertRows[0];
  const firstUnitGrammarAnchor = firstUnitMeta.grammar_anchor?.trim() ?? "";
  const firstUnitSituationContext = firstUnitMeta.situation_context?.trim() ?? "";

  if (!firstUnitGrammarAnchor || !firstUnitSituationContext) {
    console.error("[course/skeleton] first unit missing grammar_anchor or situation_context");
    await deleteFailedCourse(adminClient, course_id);
    return NextResponse.json(
      { error: "First unit is missing grammar_anchor or situation_context." },
      { status: 500 }
    );
  }

  const { data: firstUnitLessonRows, error: firstUnitLessonsErr } = await adminClient
    .from("lessons")
    .select("id")
    .eq("unit_id", firstInserted.id as string)
    .order("order_index", { ascending: true });

  if (firstUnitLessonsErr) {
    console.error("[course/skeleton] first unit lessons:", firstUnitLessonsErr);
    await deleteFailedCourse(adminClient, course_id);
    return NextResponse.json({ error: firstUnitLessonsErr.message }, { status: 500 });
  }

  for (const lesson of firstUnitLessonRows ?? []) {
    const result = await generateCards({
      userId: user.id,
      unit_id: firstInserted.id as string,
      lesson_id: lesson.id as string,
      topic_key: firstUnitMeta.topic_key,
      grammar_anchor: firstUnitGrammarAnchor,
      situation_context: firstUnitSituationContext,
      language_code,
      cefr_level
    });

    if (!result.ok) {
      console.error(
        `[course/skeleton] generateCards failed lesson_id=${lesson.id}:`,
        result.error
      );
      await deleteFailedCourse(adminClient, course_id);
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  }

  return NextResponse.json({
    course_id,
    units_count: unitInsertRows.length,
    first_unit_id: firstInserted.id as string
  });
}
