import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { KnownLanguage } from "@/types";
import { createPlacementSession, type PlacementStoredQuestion } from "@/lib/placement-session-cache";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 3000;

const SYSTEM_PROMPT =
  "You are a CEFR-certified language assessment expert. Generate placement tests that accurately identify learner levels using validated question formats from official CEFR frameworks.";

function sliceJsonObject(text: string): string {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON object found in response");
  }
  return text.slice(firstBrace, lastBrace + 1);
}

function isValidQuestion(entry: unknown): entry is PlacementStoredQuestion {
  if (!entry || typeof entry !== "object") return false;
  const q = entry as Record<string, unknown>;
  const type = q.type;
  const cefr = q.cefr_level;
  const prompt = q.prompt;
  const correct = q.correct_answer;
  const validType =
    type === "vocabulary" || type === "grammar" || type === "comprehension";
  const validCefr =
    cefr === "A1" ||
    cefr === "A2" ||
    cefr === "B1" ||
    cefr === "B2" ||
    cefr === "C1" ||
    cefr === "C2";
  return (
    validType &&
    validCefr &&
    typeof prompt === "string" &&
    prompt.trim().length > 0 &&
    typeof correct === "string" &&
    correct.trim().length > 0
  );
}

function parseQuestionsFromResponse(raw: string | null | undefined, label: string): PlacementStoredQuestion[] {
  if (!raw?.trim()) {
    console.warn(`[placement/generate] ${label}: empty response`);
    return [];
  }
  try {
    const jsonStr = sliceJsonObject(raw);
    const parsed = JSON.parse(jsonStr) as { questions?: unknown };
    if (!Array.isArray(parsed.questions)) {
      console.warn(`[placement/generate] ${label}: missing questions array`);
      return [];
    }
    const kept = parsed.questions.filter(isValidQuestion);
    if (kept.length < parsed.questions.length) {
      console.warn(
        `[placement/generate] ${label}: dropped ${parsed.questions.length - kept.length} invalid entries`
      );
    }
    return kept;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[placement/generate] ${label}: parse error`, message, raw.slice(0, 400));
    return [];
  }
}

function buildPrompt(languageName: string, knownSummary: string): string {
  return `Generate exactly 10 placement questions (MVP) for ${languageName}.
Learner's known languages: ${knownSummary}

IMPORTANT: Reference the learner's known languages where helpful (similarities/differences with ${languageName}).

Return ONLY valid JSON (double-quoted keys and strings):
{
  "questions": [
    {
      "id": string,
      "type": "vocabulary"|"grammar"|"comprehension",
      "cefr_level": "A1"|"A2"|"B1"|"B2"|"C1"|"C2",
      "topic_key": string,
      "prompt": string,
      "context": string,
      "options": array of 4 strings OR null for grammar,
      "correct_answer": string,
      "explanation": string
    }
  ]
}

Exact distribution (10 total):
- 3 vocabulary: one each at A1, A2, B1
- 3 grammar: one each at A1, A2, B1 (use "options": null for fill-in)
- 2 comprehension: one at A1, one at A2 (include short "context" passage when needed)
- 2 harder items: one vocabulary or comprehension at B2, one at C1 (to identify advanced learners)

Order questions roughly from easier to harder. Use "context" as "" when not needed. Vocabulary and multiple-choice: exactly 4 strings in "options". Grammar fill-in: "options": null.
Include "topic_key" on every question. Do not reveal correct answers in the prompt text.`;
}

interface GenerateBody {
  language_code: string;
  language_name: string;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { language_code, language_name } = body;
  if (!language_code || !language_name) {
    return NextResponse.json(
      { error: "Invalid body: require language_code and language_name." },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: knownRows, error: knownError } = await supabase
    .from("known_languages")
    .select("language_name, proficiency")
    .eq("user_id", user.id);

  if (knownError) {
    return NextResponse.json({ error: knownError.message }, { status: 500 });
  }

  const known = (knownRows ?? []) as Pick<KnownLanguage, "language_name" | "proficiency">[];
  const knownSummary =
    known.length > 0
      ? known.map((l) => `${l.language_name} (${l.proficiency})`).join(", ")
      : "None specified";

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let raw: string | null = null;
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(language_name, knownSummary) }]
    });
    const block = message.content[0];
    raw = block.type === "text" ? block.text : "";
    console.log("[placement/generate] raw (first 500 chars):", (raw ?? "").slice(0, 500));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[placement/generate] Anthropic error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const parsed = parseQuestionsFromResponse(raw, "single_batch");
  const combined = parsed.slice(0, 10).map((q, index) => ({
    ...q,
    id: `q${index + 1}`
  }));

  const warnings: string[] = [];
  if (parsed.length < 10) {
    warnings.push(`Expected 10 questions, parsed ${parsed.length}.`);
  }

  if (combined.length === 0) {
    return NextResponse.json(
      {
        error: "No questions could be generated. Try again in a moment.",
        warning: warnings.join(" ")
      },
      { status: 503 }
    );
  }

  const test_session_id = createPlacementSession({
    userId: user.id,
    language_code,
    language_name,
    questions: combined
  });

  const questionsForClient = combined.map(({ correct_answer: _omit, ...rest }) => rest);
  const warning = warnings.length > 0 ? warnings.join(" ") : undefined;

  return NextResponse.json({
    test_session_id,
    questions: questionsForClient,
    ...(warning ? { warning } : {})
  });
}
