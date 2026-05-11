import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPlacementSession, type PlacementStoredQuestion } from "@/lib/placement-session-cache";

export const runtime = "nodejs";

type DbSection = "vocabulary" | "grammar" | "reading" | "writing";

interface GenerateBody {
  language_code: string;
  language_name: string;
}

type PlacementQuestionClientRow = {
  id: string;
  section: string;
  cefr_level: string;
  prompt: string;
  context_text: string | null;
  options: unknown;
  order_index: number;
};

type PlacementQuestionFullRow = PlacementQuestionClientRow & {
  correct_answer: string;
};

const ROMANCE_CODES = new Set(["fr", "es", "it", "pt", "ca", "ro"]);
const GERMANIC_CODES = new Set(["en", "de", "nl", "sv", "da", "no"]);
const SLAVIC_CODES = new Set(["ru", "pl", "cs", "uk", "bg"]);

function detectProfile(knownLanguageCodes: string[]): "romance" | "germanic" | "slavic" | "other" {
  for (const code of knownLanguageCodes) {
    if (ROMANCE_CODES.has(code)) return "romance";
  }
  for (const code of knownLanguageCodes) {
    if (GERMANIC_CODES.has(code)) return "germanic";
  }
  for (const code of knownLanguageCodes) {
    if (SLAVIC_CODES.has(code)) return "slavic";
  }
  return "other";
}

function normalizeOptions(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const strings = raw.filter((x): x is string => typeof x === "string");
  return strings.length > 0 ? strings : null;
}

function toStoredQuestion(row: PlacementQuestionFullRow): PlacementStoredQuestion {
  const section = row.section as DbSection;
  const type: PlacementStoredQuestion["type"] =
    section === "vocabulary"
      ? "vocabulary"
      : section === "grammar"
        ? "grammar"
        : section === "reading"
          ? "reading"
          : "writing";

  return {
    id: row.id,
    type,
    cefr_level: row.cefr_level as PlacementStoredQuestion["cefr_level"],
    topic_key: `${row.section}_${row.cefr_level}`,
    prompt: row.prompt.trim(),
    context: row.context_text?.trim() ?? "",
    options: normalizeOptions(row.options),
    correct_answer: row.correct_answer.trim(),
    explanation: ""
  };
}

function toClientQuestion(row: PlacementQuestionClientRow): {
  id: string;
  section: DbSection;
  cefr_level: string;
  prompt: string;
  context_text: string | null;
  options: string[] | null;
  order_index: number;
  skippable: boolean;
} {
  const section = row.section as DbSection;
  return {
    id: row.id,
    section,
    cefr_level: row.cefr_level,
    prompt: row.prompt,
    context_text: row.context_text,
    options: normalizeOptions(row.options),
    order_index: row.order_index,
    skippable: section === "writing"
  };
}

export async function POST(request: Request) {
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { language_code, language_name } = body;
  if (!language_code?.trim() || !language_name?.trim()) {
    return NextResponse.json(
      { error: "Invalid body: require language_code and language_name." },
      { status: 400 }
    );
  }

  const code = language_code.toLowerCase().trim();
  const name = language_name.trim();

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: knownRows } = await supabase
    .from("known_languages")
    .select("language_code")
    .eq("user_id", user.id);

  const knownCodes = (knownRows ?? []).map((r) => String(r.language_code).toLowerCase());
  const filtered = knownCodes.filter((c) => c !== code);
  const learnerProfile = detectProfile(filtered);

  let activeProfile = learnerProfile;

  let { data: clientRows, error: clientErr } = await supabase
    .from("placement_questions")
    .select("id, section, cefr_level, prompt, context_text, options, order_index")
    .eq("language_code", code)
    .eq("learner_profile", activeProfile)
    .order("order_index", { ascending: true });

  if (clientErr) {
    console.error("[placement/generate] client select:", clientErr);
    return NextResponse.json({ error: clientErr.message }, { status: 500 });
  }

  if (!clientRows?.length) {
    const { data: fallbackRows } = await supabase
      .from("placement_questions")
      .select("id, section, cefr_level, prompt, context_text, options, order_index")
      .eq("language_code", code)
      .eq("learner_profile", "other")
      .order("order_index", { ascending: true });

    if (fallbackRows?.length) {
      clientRows = fallbackRows;
      activeProfile = "other";
    } else {
      return NextResponse.json(
        { error: "No placement questions found for this language. Please try again later." },
        { status: 404 }
      );
    }
  }

  const { data: fullRows, error: fullErr } = await supabase
    .from("placement_questions")
    .select("id, section, cefr_level, prompt, context_text, options, correct_answer, order_index")
    .eq("language_code", code)
    .eq("learner_profile", activeProfile)
    .order("order_index", { ascending: true });

  if (fullErr) {
    console.error("[placement/generate] full select:", fullErr);
    return NextResponse.json({ error: fullErr.message }, { status: 500 });
  }

  if (!fullRows?.length || fullRows.length !== clientRows.length) {
    return NextResponse.json(
      { error: "Placement question set is incomplete. Please try again later." },
      { status: 500 }
    );
  }

  for (let i = 0; i < clientRows.length; i += 1) {
    if (clientRows[i].id !== fullRows[i].id || clientRows[i].order_index !== fullRows[i].order_index) {
      return NextResponse.json(
        { error: "Placement question ordering mismatch. Please try again later." },
        { status: 500 }
      );
    }
  }

  const requiredSections = new Set(["vocabulary", "grammar", "reading"]);
  const requiredCount = fullRows.filter((r) => requiredSections.has(r.section)).length;
  const writingCount = fullRows.filter((r) => r.section === "writing").length;
  if (requiredCount !== 26 || writingCount !== 4) {
    console.warn(
      `[placement/generate] expected 26 required + 4 writing for ${code}, got required=${requiredCount} writing=${writingCount}`
    );
  }

  const stored: PlacementStoredQuestion[] = (fullRows as PlacementQuestionFullRow[]).map(toStoredQuestion);

  const test_session_id = await createPlacementSession({
    userId: user.id,
    language_code: code,
    language_name: name,
    questions: stored
  });

  const questions = (clientRows as PlacementQuestionClientRow[]).map(toClientQuestion);

  return NextResponse.json({
    test_session_id,
    questions
  });
}
