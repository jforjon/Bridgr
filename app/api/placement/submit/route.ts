import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CEFR_LEVELS, SUPPORTED_LANGUAGES, type CEFRLevel } from "@/types";
import {
  deletePlacementSession,
  getPlacementSession,
  type PlacementStoredQuestion
} from "@/lib/placement-session-cache";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5-20251001";

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function isMultipleChoice(q: PlacementStoredQuestion): boolean {
  return Array.isArray(q.options) && q.options.length > 0;
}

function scoreMcq(question: PlacementStoredQuestion, userAnswer: string): boolean {
  return normalizeAnswer(userAnswer) === normalizeAnswer(question.correct_answer);
}

function resolveLanguageNameForSubmit(code: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  if (found) return found.name;
  if (code === "ca") return "Catalan";
  return code.length > 0 ? code.charAt(0).toUpperCase() + code.slice(1) : code;
}

async function judgeFillIn(
  client: Anthropic,
  question: PlacementStoredQuestion,
  userAnswer: string
): Promise<boolean> {
  const textBlock = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system:
      'You grade short language-learner answers. Reply ONLY with compact JSON: {"correct":true} or {"correct":false}.',
    messages: [
      {
        role: "user",
        content: `Target language exercise.
Question: ${question.prompt}
${question.context ? `Context: ${question.context}\n` : ""}Reference answer: ${question.correct_answer}
Learner answer: ${userAnswer}

Accept if the learner answer has the same meaning; minor spelling/accents/punctuation differences are OK if clearly the same content.`
      }
    ]
  });
  const block = textBlock.content[0];
  const text = block.type === "text" ? block.text : "";
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) return false;
  try {
    const parsed = JSON.parse(text.slice(first, last + 1)) as { correct?: boolean };
    return parsed.correct === true;
  } catch {
    return false;
  }
}

interface SubmitTestBody {
  test_session_id: string;
  answers: { question_id: string; answer: string }[];
}

function isCefrLevel(value: unknown): value is CEFRLevel {
  return typeof value === "string" && (CEFR_LEVELS as readonly string[]).includes(value);
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

  if (raw.skipped === true) {
    const language_code =
      typeof raw.language_code === "string" ? raw.language_code.toLowerCase().trim() : "";
    const cefr_level = raw.cefr_level;
    const language_name =
      typeof raw.language_name === "string" && raw.language_name.trim()
        ? raw.language_name.trim()
        : resolveLanguageNameForSubmit(language_code);

    if (!language_code) {
      return NextResponse.json({ error: "Invalid body: require language_code." }, { status: 400 });
    }
    if (!isCefrLevel(cefr_level)) {
      return NextResponse.json({ error: "Invalid body: require valid cefr_level." }, { status: 400 });
    }

    const { error: placementError } = await supabase.from("placements").upsert(
      {
        user_id: user.id,
        language_code,
        cefr_level,
        score: 0,
        total_questions: 0,
        weak_areas: [],
        skipped: true,
        completed_at: new Date().toISOString()
      },
      { onConflict: "user_id,language_code" }
    );

    if (placementError) {
      console.error("[placement/submit] placements upsert (self-report):", placementError);
      return NextResponse.json({ error: placementError.message }, { status: 500 });
    }

    const { error: learningError } = await supabase.from("learning_languages").upsert(
      {
        user_id: user.id,
        language_code,
        language_name,
        cefr_level,
        placement_completed: true
      },
      { onConflict: "user_id,language_code" }
    );

    if (learningError) {
      console.error("[placement/submit] learning_languages upsert (self-report):", learningError);
      return NextResponse.json({ error: learningError.message }, { status: 500 });
    }

    return NextResponse.json({
      cefr_level,
      score: 0,
      total: 0,
      weak_areas: [] as string[]
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  const body = raw as unknown as SubmitTestBody;
  const { test_session_id, answers } = body;
  if (!test_session_id || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: "Invalid body: require test_session_id and answers array." },
      { status: 400 }
    );
  }

  const session = getPlacementSession(test_session_id);
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "Invalid or expired test session." }, { status: 404 });
  }

  const answerById = new Map(answers.map((a) => [a.question_id, a.answer ?? ""]));
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const topicStats = new Map<string, { total: number; correct: number }>();
  let correctCount = 0;
  const total = session.questions.length;

  for (const question of session.questions) {
    const rawAnswer = answerById.get(question.id) ?? "";
    let ok = false;
    if (isMultipleChoice(question)) {
      ok = scoreMcq(question, rawAnswer);
    } else {
      ok = await judgeFillIn(client, question, rawAnswer);
    }
    if (ok) correctCount += 1;

    const topicKey = question.topic_key?.trim() || `${question.type}_${question.cefr_level}`;
    const prev = topicStats.get(topicKey) ?? { total: 0, correct: 0 };
    prev.total += 1;
    if (ok) prev.correct += 1;
    topicStats.set(topicKey, prev);
  }

  const weak_areas: string[] = [];
  for (const [topic_key, { total: t, correct: c }] of topicStats) {
    if (t > 0 && c / t < 0.5) {
      weak_areas.push(topic_key);
    }
  }

  // TODO: restore score-based CEFR when placement test has enough questions and harder distractors
  const cefr_level: CEFRLevel = "A1";

  const { error: placementError } = await supabase.from("placements").upsert(
    {
      user_id: user.id,
      language_code: session.language_code,
      cefr_level,
      score: correctCount,
      total_questions: total,
      weak_areas,
      skipped: false,
      completed_at: new Date().toISOString()
    },
    { onConflict: "user_id,language_code" }
  );

  if (placementError) {
    console.error("[placement/submit] placements upsert:", placementError);
    return NextResponse.json({ error: placementError.message }, { status: 500 });
  }

  const { error: learningError } = await supabase.from("learning_languages").upsert(
    {
      user_id: user.id,
      language_code: session.language_code,
      language_name: session.language_name,
      cefr_level,
      placement_completed: true
    },
    { onConflict: "user_id,language_code" }
  );

  if (learningError) {
    console.error("[placement/submit] learning_languages upsert:", learningError);
    return NextResponse.json({ error: learningError.message }, { status: 500 });
  }

  deletePlacementSession(test_session_id);

  return NextResponse.json({
    cefr_level,
    score: correctCount,
    total,
    weak_areas
  });
}
