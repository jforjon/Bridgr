import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { generateLessonsForUnit } from "@/lib/generate-lessons";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { CEFR_LEVELS, SUPPORTED_LANGUAGES, type CEFRLevel } from "@/types";

export const runtime = "nodejs";

const COURSE_MODEL = "claude-sonnet-4-5";
const COURSE_MAX_TOKENS = 2000;

const SYSTEM_PROMPT =
  "You are a language curriculum specialist. You create personalised learning paths based on CEFR frameworks and the learner's linguistic background.";

function resolveLanguageName(code: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  if (found) return found.name;
  return code.length > 0 ? code.charAt(0).toUpperCase() + code.slice(1) : code;
}

function sliceJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) {
    throw new Error("No JSON object found in model response");
  }
  return text.slice(first, last + 1);
}

/** DB / clients may send `a1`; curriculum_topics uses `A1`. */
function normalizeCefrLevelInput(value: unknown): CEFRLevel | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return (CEFR_LEVELS as readonly string[]).includes(normalized) ? (normalized as CEFRLevel) : null;
}

interface GeneratedUnitRow {
  topic_key: string;
  title: string;
  description: string;
  order_index: number;
  personalisation_note: string;
}

function buildCourseUserPrompt(params: {
  language_name: string;
  language_code: string;
  cefr_level: string;
  known_languages_summary: string;
  weak_areas_list: string;
  topics_json: string;
}): string {
  return `Create a personalised unit order for a learner.
Target language: ${params.language_name}
Learner's CEFR level: ${params.cefr_level}
Known languages: ${params.known_languages_summary}
Weak areas from placement: ${params.weak_areas_list}
Available topics: ${params.topics_json}

Return ONLY valid JSON (double-quoted keys and strings):
{
  "units": [
    {
      "topic_key": string,
      "title": string,
      "description": string,
      "order_index": number,
      "personalisation_note": string
    }
  ]
}

Rules:
- Order topics to maximise transfer from known languages
- Put weak areas from placement earlier
- Grammar topics should follow vocabulary topics on the same theme
- First unit must always be unlocked, rest locked (express via order_index only; the client will set locks)
- Use only topic_key values that appear in the available topics list
- description must be one sentence; mention a cross-language connection when relevant
- personalisation_note explains why this order fits THIS learner`;
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  const [{ data: knownRows, error: knownErr }, { data: learningRow, error: learningErr }, { data: placementRow }] =
    await Promise.all([
      supabase.from("known_languages").select("language_code, language_name, proficiency").eq("user_id", user.id),
      supabase
        .from("learning_languages")
        .select("language_name, cefr_level")
        .eq("user_id", user.id)
        .eq("language_code", language_code)
        .maybeSingle(),
      supabase
        .from("placements")
        .select("cefr_level, weak_areas")
        .eq("user_id", user.id)
        .eq("language_code", language_code)
        .maybeSingle()
    ]);

  if (knownErr) {
    console.error("[course/generate] known_languages:", knownErr);
    return NextResponse.json({ error: knownErr.message }, { status: 500 });
  }
  if (learningErr) {
    console.error("[course/generate] learning_languages:", learningErr);
    return NextResponse.json({ error: learningErr.message }, { status: 500 });
  }
  const learningCefrRaw = learningRow?.cefr_level;
  const learningCefrNormalized = normalizeCefrLevelInput(learningCefrRaw);
  console.log("learning_languages cefr_level for user:", {
    raw: learningCefrRaw,
    normalized: learningCefrNormalized,
    language_code
  });

  if (!learningRow || !learningCefrNormalized) {
    return NextResponse.json(
      { error: "Add this language under learning languages before generating a course." },
      { status: 400 }
    );
  }

  const placementCefrNormalized = normalizeCefrLevelInput(placementRow?.cefr_level);
  console.log("placement cefr_level (raw / normalized):", {
    raw: placementRow?.cefr_level,
    normalized: placementCefrNormalized
  });
  const cefr_level: CEFRLevel = placementCefrNormalized ?? learningCefrNormalized;

  const weak_areas = Array.isArray(placementRow?.weak_areas)
    ? (placementRow!.weak_areas as string[])
    : [];

  const language_name =
    learningRow.language_name?.trim() || resolveLanguageName(language_code);

  console.log("generating course for:", language_code, cefr_level);

  let adminClient;
  try {
    adminClient = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[course/generate] service role client:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const {
    data: topicRows,
    error: topicsErr,
    count: topicsCount
  } = await adminClient
    .from("curriculum_topics")
    .select("topic_key, topic_name, topic_type", { count: "exact" })
    .eq("language_code", language_code)
    .eq("cefr_level", cefr_level)
    .order("order_index", { ascending: true });

  console.log("curriculum topics query:", { data: topicRows, error: topicsErr, count: topicsCount });

  if (topicsErr) {
    console.error("[course/generate] curriculum_topics:", topicsErr);
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

  const known_languages_summary =
    (knownRows ?? []).length === 0
      ? "(none listed)"
      : (knownRows ?? [])
          .map(
            (k) =>
              `${k.language_name} (${k.language_code})${k.proficiency ? ` ~${k.proficiency}` : ""}`
          )
          .join(", ");

  const topics_json = JSON.stringify(
    topicRows.map((t) => ({
      topic_key: t.topic_key,
      topic_name: t.topic_name,
      topic_type: t.topic_type
    }))
  );

  const weak_areas_list = weak_areas.length ? weak_areas.join(", ") : "(none)";

  const userPrompt = buildCourseUserPrompt({
    language_name,
    language_code,
    cefr_level,
    known_languages_summary,
    weak_areas_list,
    topics_json
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let text: string;
  try {
    const message = await client.messages.create({
      model: COURSE_MODEL,
      max_tokens: COURSE_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    });
    const block = message.content[0];
    text = block.type === "text" ? block.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "Empty model response." }, { status: 502 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[course/generate] Anthropic:", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let parsed: { units?: unknown };
  try {
    parsed = JSON.parse(sliceJsonObject(text)) as { units?: unknown };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[course/generate] JSON parse:", message, text.slice(0, 400));
    return NextResponse.json({ error: `Failed to parse course JSON: ${message}` }, { status: 502 });
  }

  if (!Array.isArray(parsed.units)) {
    return NextResponse.json({ error: "Invalid course JSON: missing units array." }, { status: 502 });
  }

  const validKeys = new Set(topicRows.map((t) => t.topic_key));
  const rawUnits = parsed.units as GeneratedUnitRow[];

  const sorted = [...rawUnits].sort(
    (a, b) => (Number(a.order_index) || 0) - (Number(b.order_index) || 0)
  );

  const seen = new Set<string>();
  const normalized: GeneratedUnitRow[] = [];
  for (const u of sorted) {
    const key = typeof u.topic_key === "string" ? u.topic_key.trim() : "";
    if (!key || !validKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      topic_key: key,
      title: typeof u.title === "string" && u.title.trim() ? u.title.trim() : key,
      description: typeof u.description === "string" ? u.description : "",
      order_index: typeof u.order_index === "number" ? u.order_index : normalized.length,
      personalisation_note:
        typeof u.personalisation_note === "string" ? u.personalisation_note : ""
    });
  }

  if (normalized.length === 0) {
    return NextResponse.json(
      { error: "Model returned no units matching curriculum topic_key values." },
      { status: 502 }
    );
  }

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
    console.error("[course/generate] courses upsert:", courseErr);
    return NextResponse.json({ error: courseErr?.message ?? "Course upsert failed." }, { status: 500 });
  }

  const course_id = courseRow.id as string;

  const { error: delUnitsErr } = await supabase.from("units").delete().eq("course_id", course_id);
  if (delUnitsErr) {
    console.error("[course/generate] units delete:", delUnitsErr);
    return NextResponse.json({ error: delUnitsErr.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const unitInsertRows = normalized.map((u, i) => ({
    course_id,
    topic_key: u.topic_key,
    title: u.title,
    description: u.description || null,
    personalisation_note: u.personalisation_note || null,
    cefr_level,
    order_index: i,
    status: i === 0 ? ("available" as const) : ("locked" as const),
    unlocked_at: i === 0 ? now : null
  }));

  const { data: insertedUnits, error: unitsInsErr } = await supabase
    .from("units")
    .insert(unitInsertRows)
    .select("id, order_index")
    .order("order_index", { ascending: true });

  if (unitsInsErr || !insertedUnits?.length) {
    console.error("[course/generate] units insert:", unitsInsErr);
    await supabase.from("courses").delete().eq("id", course_id);
    return NextResponse.json({ error: unitsInsErr?.message ?? "Unit insert failed." }, { status: 500 });
  }

  const first_unit_id = insertedUnits[0].id as string;
  const first_topic_key = normalized[0].topic_key;

  const knownForLessons = (knownRows ?? []).map((k) => ({
    language_code: k.language_code,
    language_name: k.language_name,
    proficiency: k.proficiency ?? undefined
  }));

  try {
    await generateLessonsForUnit(
      supabase,
      first_unit_id,
      first_topic_key,
      language_code,
      cefr_level,
      knownForLessons
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[course/generate] generateLessonsForUnit:", e);
    await supabase.from("courses").delete().eq("id", course_id);
    return NextResponse.json(
      { error: `Lesson generation failed: ${message}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    course_id,
    units_count: insertedUnits.length,
    first_unit_id
  });
}
