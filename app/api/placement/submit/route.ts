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

const JUDGE_MODEL_GRAMMAR = "claude-haiku-4-5";
const JUDGE_MAX_TOKENS_GRAMMAR = 200;
const JUDGE_MODEL_WRITING = "claude-haiku-4-5-20251001";
const JUDGE_MAX_TOKENS_WRITING = 300;

/** CEFR ladder for placement (cap C1; C2 not used in bank). */
const PLACEMENT_LEVEL_ORDER: readonly CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1"];

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
  userAnswer: string,
  opts?: { model?: string; maxTokens?: number }
): Promise<boolean> {
  const model = opts?.model ?? JUDGE_MODEL_GRAMMAR;
  const max_tokens = opts?.maxTokens ?? JUDGE_MAX_TOKENS_GRAMMAR;
  const textBlock = await client.messages.create({
    model,
    max_tokens,
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

function isAnswerEmpty(raw: string): boolean {
  return raw.trim() === "";
}

function placementFromLevelStats(levelStats: Map<CEFRLevel, { correct: number; total: number }>): CEFRLevel {
  let result: CEFRLevel = "A1";
  for (const level of PLACEMENT_LEVEL_ORDER) {
    const s = levelStats.get(level);
    if (!s || s.total === 0) continue;
    const passed = s.correct / s.total >= 0.5;
    if (passed) {
      result = level;
    } else {
      break;
    }
  }
  return result;
}

interface SubmitTestBody {
  test_session_id: string;
  answers: { question_id: string; answer: string }[];
}

function isCefrLevel(value: unknown): value is CEFRLevel {
  return typeof value === "string" && (CEFR_LEVELS as readonly string[]).includes(value);
}

async function triggerCourseGeneration(request: Request, language_code: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    console.error("course generation skipped: NEXT_PUBLIC_APP_URL is not set");
    return;
  }
  const origin = baseUrl.replace(/\/$/, "");
  try {
    const courseRes = await fetch(`${origin}/api/course/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? ""
      },
      body: JSON.stringify({ language_code: language_code.toLowerCase().trim() })
    });
    if (!courseRes.ok) {
      console.error("course generation failed:", await courseRes.text());
    }
  } catch (e) {
    console.error("course generation request failed:", e);
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const supabase = createClient();

  /** Beginner skip / self-report: no session, no scoring, no Anthropic. */
  if (body.skipped === true) {
    console.log("placement/submit body:", body);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const language_code =
      typeof body.language_code === "string" ? body.language_code.toLowerCase().trim() : "";
    const language_name =
      typeof body.language_name === "string" && body.language_name.trim()
        ? body.language_name.trim()
        : resolveLanguageNameForSubmit(language_code);
    const cefr_level: CEFRLevel = isCefrLevel(body.cefr_level) ? body.cefr_level : "A1";
    const now = new Date().toISOString();

    if (!language_code) {
      return NextResponse.json({ error: "Invalid body: require language_code." }, { status: 400 });
    }

    const { error: placementsError } = await supabase.from("placements").upsert(
      {
        user_id: user.id,
        language_code,
        cefr_level,
        score: 0,
        total_questions: 0,
        weak_areas: [],
        skipped: true,
        completed_at: now
      },
      { onConflict: "user_id,language_code" }
    );

    if (placementsError) {
      console.log("placements upsert error:", placementsError);
      return NextResponse.json({ error: placementsError.message }, { status: 500 });
    }

    const { error: llError } = await supabase.from("learning_languages").upsert(
      {
        user_id: user.id,
        language_code,
        language_name,
        cefr_level,
        placement_completed: true,
        last_accessed_at: now
      },
      { onConflict: "user_id,language_code" }
    );

    if (llError) {
      console.log("learning_languages upsert error:", llError);
      return NextResponse.json({ error: llError.message }, { status: 500 });
    }

    await triggerCourseGeneration(request, language_code);

    console.log("placement/submit response: skipped success");
    return NextResponse.json({ cefr_level, skipped: true });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  const gradedBody = body as unknown as SubmitTestBody;
  const { test_session_id, answers } = gradedBody;
  if (!test_session_id || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: "Invalid body: require test_session_id and answers array." },
      { status: 400 }
    );
  }

  const session = await getPlacementSession(test_session_id);
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "Invalid or expired test session." }, { status: 404 });
  }

  const answerById = new Map(answers.map((a) => [a.question_id, a.answer ?? ""]));
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const writingQuestions = session.questions.filter((q) => q.type === "writing");
  const allWritingSkipped =
    writingQuestions.length > 0 &&
    writingQuestions.every((q) => isAnswerEmpty(answerById.get(q.id) ?? ""));

  const topicStats = new Map<string, { total: number; correct: number }>();
  const levelStats = new Map<CEFRLevel, { correct: number; total: number }>();

  const bumpLevelStat = (level: CEFRLevel, ok: boolean) => {
    const prev = levelStats.get(level) ?? { correct: 0, total: 0 };
    prev.total += 1;
    if (ok) prev.correct += 1;
    levelStats.set(level, prev);
  };

  let correctCount = 0;
  const total = session.questions.length;

  for (const question of session.questions) {
    const rawAnswer = answerById.get(question.id) ?? "";
    const empty = isAnswerEmpty(rawAnswer);

    let ok = false;
    if (question.type === "writing") {
      if (allWritingSkipped) {
        ok = false;
      } else if (empty) {
        ok = false;
      } else {
        ok = await judgeFillIn(client, question, rawAnswer, {
          model: JUDGE_MODEL_WRITING,
          maxTokens: JUDGE_MAX_TOKENS_WRITING
        });
      }
    } else if (isMultipleChoice(question)) {
      ok = !empty && scoreMcq(question, rawAnswer);
    } else {
      ok = !empty && (await judgeFillIn(client, question, rawAnswer));
    }

    if (ok) correctCount += 1;

    const topicKey = question.topic_key?.trim() || `${question.type}_${question.cefr_level}`;
    const prev = topicStats.get(topicKey) ?? { total: 0, correct: 0 };
    prev.total += 1;
    if (ok) prev.correct += 1;
    topicStats.set(topicKey, prev);

    bumpLevelStat(question.cefr_level, ok);
  }

  const weak_areas: string[] = [];
  for (const [topic_key, { total: t, correct: c }] of topicStats) {
    if (t > 0 && c / t < 0.5) {
      weak_areas.push(topic_key);
    }
  }

  const cefr_level = placementFromLevelStats(levelStats);

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

  await triggerCourseGeneration(request, session.language_code);

  await deletePlacementSession(test_session_id);

  return NextResponse.json({
    cefr_level,
    score: correctCount,
    total,
    weak_areas
  });
}
