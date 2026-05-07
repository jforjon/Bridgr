import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 300;

const SYSTEM_PROMPT =
  "You are an encouraging language teacher. You evaluate learner answers generously — accepting typos, conjugation variants, and close synonyms. You never make learners feel bad for mistakes. Mistakes are learning opportunities.";

function sliceJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) {
    throw new Error("No JSON object found in model response");
  }
  return text.slice(first, last + 1);
}

type EvaluateResult = "correct" | "typo" | "close" | "wrong";

function isEvaluateResult(v: unknown): v is EvaluateResult {
  return v === "correct" || v === "typo" || v === "close" || v === "wrong";
}

function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "");
}

function formatKnownLanguages(known_languages: unknown): string {
  if (!Array.isArray(known_languages) || known_languages.length === 0) {
    return "(none)";
  }
  const parts: string[] = [];
  for (const entry of known_languages) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const language = typeof o.language === "string" ? o.language.trim() : "";
    const cefr_level = typeof o.cefr_level === "string" ? o.cefr_level.trim() : "";
    if (!language) continue;
    parts.push(cefr_level ? `${language} (${cefr_level})` : language);
  }
  return parts.length > 0 ? parts.join(", ") : "(none)";
}

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const word = typeof body.word === "string" ? body.word.trim() : "";
  const typed_answer = typeof body.typed_answer === "string" ? body.typed_answer : "";
  const correct_answer = typeof body.correct_answer === "string" ? body.correct_answer.trim() : "";
  const language_code =
    typeof body.language_code === "string" ? body.language_code.toLowerCase().trim() : "";

  if (!word || !correct_answer || !language_code) {
    return NextResponse.json(
      { error: "Invalid body: require word, correct_answer, and language_code." },
      { status: 400 }
    );
  }

  const knownSummary = formatKnownLanguages(body.known_languages);

  const userPrompt = `The learner is studying ${language_code}. They see this TARGET-LANGUAGE word on the card:
"${word}"

They must type the ENGLISH gloss (meaning in English). The correct English answer is:
"${correct_answer}"

What the learner typed:
"${typed_answer}"

Learner also speaks (for context only): ${knownSummary}

Evaluate and return ONLY valid JSON (double-quoted keys and strings):
{
  "result": "correct"|"typo"|"close"|"wrong",
  "message": string,
  "show_correct": boolean
}

Rules:
- Compare the learner's typed text to the ENGLISH gloss "${correct_answer}". Ignore case and surrounding whitespace. Do NOT ask them to repeat the ${language_code} word unless they clearly answered in the wrong language.
- If their answer matches the English gloss (exactly or with only trivial punctuation/spacing differences), result MUST be "correct".
- result must be exactly one of: correct, typo, close, wrong
- typo: almost the right English, small spelling slip. close: related but not the best gloss. wrong: clearly incorrect or wrong language.
- message: 1-2 sentences, encouraging tone.
- show_correct: true only if result is "wrong".`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let text: string;
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
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
    console.error("[evaluate] Anthropic:", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let parsed: { result?: unknown; message?: unknown; show_correct?: unknown };
  try {
    parsed = JSON.parse(sliceJsonObject(text)) as typeof parsed;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[evaluate] JSON parse:", message, text.slice(0, 400));
    return NextResponse.json({ error: `Failed to parse evaluation JSON: ${message}` }, { status: 502 });
  }

  if (!isEvaluateResult(parsed.result)) {
    return NextResponse.json({ error: "Invalid model output: result must be correct, typo, close, or wrong." }, { status: 502 });
  }

  let result = parsed.result;
  let messageStr =
    typeof parsed.message === "string" && parsed.message.trim()
      ? parsed.message.trim()
      : "Nice try — keep going!";

  const typedNorm = normalizeAnswer(typed_answer);
  const expectedNorm = normalizeAnswer(correct_answer);
  if (typedNorm.length > 0 && expectedNorm.length > 0 && typedNorm === expectedNorm) {
    result = "correct";
    messageStr = "Correct!";
  }

  const show_correct = parsed.show_correct === true && result === "wrong";

  const payload: {
    result: EvaluateResult;
    message: string;
    show_correct: boolean;
    correct_answer?: string;
  } = {
    result,
    message: messageStr,
    show_correct
  };

  if (show_correct) {
    payload.correct_answer = correct_answer;
  }

  return NextResponse.json(payload);
}
