import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CardOutcome } from "@/types";

export const runtime = "nodejs";

const EVALUATE_MODEL = "claude-haiku-4-5-20251001";
const EVALUATE_MAX_TOKENS = 200;

const SYSTEM_PROMPT =
  "You are an encouraging language teacher. Evaluate the learner's answer generously. Accept: exact matches, typos (1-2 character errors), conjugation variants that preserve meaning, close synonyms. Never make learners feel bad. Mistakes are learning moments.";

type HintUsed = "none" | "first_letter" | "reveal";

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

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isHintUsed(value: unknown): value is HintUsed {
  return value === "none" || value === "first_letter" || value === "reveal";
}

function buildResponse(outcome: CardOutcome, message: string | null, correctAnswer: string) {
  const show_correct = outcome === "miss";
  return {
    outcome,
    message,
    show_correct,
    ...(show_correct ? { correct_answer: correctAnswer } : {})
  };
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const flashcard_id = typeof body.flashcard_id === "string" ? body.flashcard_id.trim() : "";
  const sentence_card_id =
    typeof body.sentence_card_id === "string" ? body.sentence_card_id.trim() : "";
  const typed_answer = typeof body.typed_answer === "string" ? body.typed_answer : "";
  const correct_answer =
    typeof body.correct_answer === "string" ? body.correct_answer.trim() : "";
  const language_code =
    typeof body.language_code === "string" ? body.language_code.toLowerCase().trim() : "";
  const hint_used = body.hint_used;

  if (
    !flashcard_id ||
    !sentence_card_id ||
    !correct_answer ||
    !language_code ||
    !isHintUsed(hint_used)
  ) {
    return NextResponse.json({ error: "Invalid body: missing or invalid fields." }, { status: 400 });
  }

  const [{ data: flashcard, error: flashcardErr }, { data: knownRows, error: knownErr }] =
    await Promise.all([
      supabase
        .from("flashcards")
        .select("id, sentence_card_id")
        .eq("id", flashcard_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("known_languages")
        .select("language_name")
        .eq("user_id", user.id)
    ]);

  if (flashcardErr) {
    console.error("[cards/evaluate] flashcard:", flashcardErr);
    return NextResponse.json({ error: flashcardErr.message }, { status: 500 });
  }
  if (!flashcard) {
    return NextResponse.json({ error: "Flashcard not found." }, { status: 404 });
  }
  if (flashcard.sentence_card_id !== sentence_card_id) {
    return NextResponse.json({ error: "Flashcard does not match sentence_card_id." }, { status: 400 });
  }
  if (knownErr) {
    console.error("[cards/evaluate] known_languages:", knownErr);
    return NextResponse.json({ error: knownErr.message }, { status: 500 });
  }

  const knownLanguageNames = (knownRows ?? [])
    .map((row) => row.language_name)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0);

  if (hint_used === "reveal") {
    return NextResponse.json(buildResponse("miss", null, correct_answer));
  }

  if (
    hint_used === "first_letter" &&
    normalizeAnswer(typed_answer) === normalizeAnswer(correct_answer)
  ) {
    return NextResponse.json(buildResponse("struggle", null, correct_answer));
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  const knownLanguagesSummary =
    knownLanguageNames.length > 0 ? knownLanguageNames.join(", ") : "(none)";

  const userPrompt = `Target language: ${language_code}
Correct answer: ${correct_answer}
Learner typed: ${typed_answer}
Known languages: ${knownLanguagesSummary}

Return ONLY valid JSON:
{
  "accepted": boolean,
  "message": string | null
}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let text: string;
  try {
    const message = await client.messages.create({
      model: EVALUATE_MODEL,
      max_tokens: EVALUATE_MAX_TOKENS,
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
    console.error("[cards/evaluate] Anthropic:", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let parsed: { accepted?: unknown; message?: unknown };
  try {
    parsed = JSON.parse(sliceJsonObject(text)) as typeof parsed;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cards/evaluate] JSON parse:", message, text.slice(0, 400));
    return NextResponse.json({ error: `Failed to parse evaluation JSON: ${message}` }, { status: 502 });
  }

  const accepted = parsed.accepted === true;
  const aiMessage =
    parsed.message === null
      ? null
      : typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message.trim()
        : null;

  let outcome: CardOutcome;
  if (accepted) {
    outcome = hint_used === "first_letter" ? "struggle" : "solid";
  } else {
    outcome = "miss";
  }

  return NextResponse.json(buildResponse(outcome, aiMessage, correct_answer));
}
