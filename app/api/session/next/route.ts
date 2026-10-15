import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import type { FalseFriendAlert, SentenceCard, SessionCard } from "@/types";

export const runtime = "nodejs";

const SESSION_LIMIT = 20;
const SRS_LIMIT = 10;

type FlashcardWithSentence = {
  id: string;
  sentence_card_id: string | null;
  stage: number | null;
  sentence_cards: SentenceCard | SentenceCard[] | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

function normalizeCrossLinguistic(raw: unknown): SentenceCard["cross_linguistic"] {
  const empty: SentenceCard["cross_linguistic"] = {
    cognates: [],
    false_friends: [],
    partial: []
  };
  if (!raw || typeof raw !== "object") return empty;
  const cl = raw as Record<string, unknown>;
  return {
    cognates: Array.isArray(cl.cognates) ? cl.cognates : [],
    false_friends: Array.isArray(cl.false_friends) ? cl.false_friends : [],
    partial: Array.isArray(cl.partial) ? cl.partial : []
  };
}

function normalizeSentenceCard(row: Record<string, unknown>): SentenceCard {
  return {
    id: String(row.id),
    lesson_id: row.lesson_id != null ? String(row.lesson_id) : null,
    language_code: String(row.language_code ?? ""),
    cefr_level: String(row.cefr_level ?? ""),
    target_item: String(row.target_item ?? ""),
    target_item_en: String(row.target_item_en ?? ""),
    english_sentence: String(row.english_sentence ?? ""),
    english_sentence_with_marker: String(row.english_sentence_with_marker ?? ""),
    target_sentence: String(row.target_sentence ?? ""),
    correct_answer: String(row.correct_answer ?? ""),
    distractors: Array.isArray(row.distractors) ? row.distractors.map(String) : [],
    part_of_speech: row.part_of_speech != null ? String(row.part_of_speech) : null,
    topic_key: row.topic_key != null ? String(row.topic_key) : null,
    situation_context: row.situation_context != null ? String(row.situation_context) : null,
    grammar_anchor: row.grammar_anchor != null ? String(row.grammar_anchor) : null,
    cross_linguistic: normalizeCrossLinguistic(row.cross_linguistic),
    created_at: String(row.created_at ?? "")
  };
}

function normalizeFalseFriendAlert(row: Record<string, unknown>): FalseFriendAlert {
  return {
    id: String(row.id),
    language_code: String(row.language_code ?? ""),
    word: String(row.word ?? ""),
    known_language_code: String(row.known_language_code ?? ""),
    known_language_word: String(row.known_language_word ?? ""),
    known_language_meaning: String(row.known_language_meaning ?? ""),
    target_meaning: String(row.target_meaning ?? ""),
    alert_shown_to: Array.isArray(row.alert_shown_to)
      ? row.alert_shown_to.map(String)
      : [],
    created_at: String(row.created_at ?? "")
  };
}

type CurrentLesson = {
  lessonId: string;
  unitId: string;
  unitCardsGenerated: boolean;
};

async function findCurrentLesson(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  languageCode: string
): Promise<CurrentLesson | null> {
  const { data: course, error: courseErr } = await adminClient
    .from("courses")
    .select("id")
    .eq("user_id", userId)
    .eq("language_code", languageCode)
    .maybeSingle();

  console.log("[session/next] course:", course?.id ?? null, courseErr?.message ?? null);

  if (courseErr || !course?.id) {
    return null;
  }

  const { data: unitRows, error: unitErr } = await adminClient
    .from("units")
    .select("id, cards_generated")
    .eq("course_id", course.id)
    .eq("status", "available")
    .order("order_index", { ascending: true })
    .limit(1);

  const unit = unitRows?.[0] ?? null;
  if (unitErr || !unit?.id) {
    console.log("[session/next] current lesson:", null, unitErr?.message ?? "no available unit");
    return null;
  }

  const { data: lessonRows, error: lessonErr } = await adminClient
    .from("lessons")
    .select("id")
    .eq("unit_id", unit.id)
    .eq("status", "available")
    .order("order_index", { ascending: true })
    .limit(1);

  const lesson = lessonRows?.[0] ?? null;
  console.log("[session/next] current lesson:", lesson?.id ?? null, lessonErr?.message ?? null);

  if (lessonErr || !lesson?.id) {
    return null;
  }

  return {
    lessonId: lesson.id as string,
    unitId: unit.id as string,
    unitCardsGenerated: unit.cards_generated === true
  };
}

export async function GET(request: Request) {
  const sessionClient = createClient();
  const {
    data: { user }
  } = await sessionClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[session/next] user_id:", user.id);

  let adminClient;
  try {
    adminClient = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[session/next] service role client:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const language_code = searchParams.get("language_code")?.toLowerCase().trim();
  if (!language_code) {
    return NextResponse.json({ error: "language_code is required" }, { status: 400 });
  }

  const today = todayIsoDate();

  const { data: srsRows, error: srsErr } = await adminClient
    .from("flashcards")
    .select(
      `
      id,
      sentence_card_id,
      stage,
      sentence_cards (*)
    `
    )
    .eq("user_id", user.id)
    .eq("language_code", language_code)
    .eq("stage", 2)
    .not("sentence_card_id", "is", null)
    .lte("next_review_date", today)
    .order("next_review_date", { ascending: true })
    .limit(SRS_LIMIT);

  if (srsErr) {
    console.error("[session/next] srs flashcards:", srsErr);
    return NextResponse.json({ error: srsErr.message }, { status: 500 });
  }

  const srsDueCards: { flashcard_id: string; sentence_card: SentenceCard }[] = [];
  for (const row of (srsRows ?? []) as FlashcardWithSentence[]) {
    const sentenceRaw = unwrapOne(row.sentence_cards);
    if (!sentenceRaw || !row.id) continue;
    srsDueCards.push({
      flashcard_id: row.id,
      sentence_card: normalizeSentenceCard(sentenceRaw as unknown as Record<string, unknown>)
    });
  }

  const currentLesson = await findCurrentLesson(adminClient, user.id, language_code);
  const currentLessonId = currentLesson?.lessonId ?? null;
  const newCardSlots = Math.max(0, SESSION_LIMIT - srsDueCards.length);

  const newStage1Cards: { flashcard_id: string; sentence_card: SentenceCard }[] = [];
  /**
   * True when, after this session, every sentence card in the current lesson
   * has a flashcard for this user — i.e. finishing this session finishes the
   * lesson's introduction and the client should mark the lesson complete.
   */
  let lessonExhausted = false;

  if (!currentLessonId || newCardSlots <= 0) {
    console.log("[session/next] sentence_cards count:", 0);
  }

  if (currentLessonId && newCardSlots > 0) {
    const { data: lessonSentenceCards, error: scErr } = await adminClient
      .from("sentence_cards")
      .select("*")
      .eq("lesson_id", currentLessonId);

    if (scErr) {
      console.error("[session/next] sentence_cards:", scErr);
      return NextResponse.json({ error: scErr.message }, { status: 500 });
    }

    console.log("[session/next] sentence_cards count:", (lessonSentenceCards ?? []).length);

    const allLessonCards = (lessonSentenceCards ?? []).map((row) =>
      normalizeSentenceCard(row as Record<string, unknown>)
    );

    if (allLessonCards.length > 0) {
      const sentenceCardIds = allLessonCards.map((c) => c.id);
      const { data: existingFlashcards, error: existingErr } = await adminClient
        .from("flashcards")
        .select("id, sentence_card_id, stage, last_outcome")
        .eq("user_id", user.id)
        .in("sentence_card_id", sentenceCardIds);

      if (existingErr) {
        console.error("[session/next] existing flashcards:", existingErr);
        return NextResponse.json({ error: existingErr.message }, { status: 500 });
      }

      const existingByCardId = new Map(
        (existingFlashcards ?? [])
          .filter(
            (f): f is { id: string; sentence_card_id: string; stage: number | null; last_outcome: string | null } =>
              typeof f.id === "string" && typeof f.sentence_card_id === "string"
          )
          .map((f) => [f.sentence_card_id, f])
      );

      const cardById = new Map(allLessonCards.map((c) => [c.id, c]));

      // Re-serve stage-1 flashcards that were created but never practiced
      // (last_outcome null). This makes the endpoint idempotent — a refresh,
      // retry, or React strict-mode double-invoke returns the same cards
      // instead of draining the session — and recovers interrupted sessions
      // whose cards would otherwise be stranded (stage 1 excludes them from
      // the SRS path, and having a flashcard excludes them from "new").
      const unpracticedStage1 = (existingFlashcards ?? []).filter(
        (f) => (f.stage ?? 1) === 1 && f.last_outcome == null && typeof f.sentence_card_id === "string"
      );
      for (const fc of unpracticedStage1) {
        const sentenceCard = cardById.get(fc.sentence_card_id as string);
        if (!sentenceCard || typeof fc.id !== "string") continue;
        newStage1Cards.push({ flashcard_id: fc.id, sentence_card: sentenceCard });
      }

      // Introduce genuinely new cards (no flashcard yet), capped per session.
      const cardsWithoutFlashcard = allLessonCards.filter((c) => !existingByCardId.has(c.id));
      const toIntroduce = cardsWithoutFlashcard.slice(0, newCardSlots);

      for (const sentenceCard of toIntroduce) {
        const { data: inserted, error: insertErr } = await adminClient
          .from("flashcards")
          .insert({
            user_id: user.id,
            sentence_card_id: sentenceCard.id,
            language_code,
            lesson_id: sentenceCard.lesson_id,
            stage: 1,
            ease_factor: 2.5,
            interval_days: 1,
            repetitions: 0,
            next_review_date: today,
            last_outcome: null,
            solid_recall_count: 0
          })
          .select("id")
          .single();

        if (insertErr || !inserted?.id) {
          console.error("[session/next] flashcard insert:", insertErr);
          continue;
        }

        newStage1Cards.push({
          flashcard_id: inserted.id as string,
          sentence_card: sentenceCard
        });
      }

      // Exhausted once every lesson card now has a flashcard — i.e. no new
      // material remains to introduce (further progress is SRS review).
      lessonExhausted = cardsWithoutFlashcard.length <= toIntroduce.length;
    } else {
      // A lesson with no sentence cards can never produce new material. Only
      // treat it as exhausted when the unit's generation already ran —
      // otherwise cards may still be on their way.
      lessonExhausted = currentLesson?.unitCardsGenerated === true;
    }
  }

  // false_friend_alerts rows are keyed by the card's target_item (see
  // lib/generate-cards.ts), so collecting target items is sufficient here.
  const wordsToCheck = new Set<string>();
  for (const card of srsDueCards) {
    wordsToCheck.add(card.sentence_card.target_item);
  }
  for (const card of newStage1Cards) {
    wordsToCheck.add(card.sentence_card.target_item);
  }

  let falseFriendAlerts: FalseFriendAlert[] = [];
  if (wordsToCheck.size > 0) {
    const { data: alertRows, error: alertErr } = await adminClient
      .from("false_friend_alerts")
      .select("*")
      .eq("language_code", language_code)
      .in("word", [...wordsToCheck]);

    if (alertErr) {
      console.error("[session/next] false_friend_alerts:", alertErr);
      return NextResponse.json({ error: alertErr.message }, { status: 500 });
    }

    falseFriendAlerts = (alertRows ?? [])
      .map((row) => normalizeFalseFriendAlert(row as Record<string, unknown>))
      .filter((alert) => !alert.alert_shown_to.includes(user.id));
  }

  const sessionCards: SessionCard[] = [];
  let remaining = SESSION_LIMIT;

  for (const alert of falseFriendAlerts) {
    if (remaining <= 0) break;
    sessionCards.push({ type: "false_friend_alert", alert });
    remaining -= 1;
  }

  for (const card of srsDueCards) {
    if (remaining <= 0) break;
    sessionCards.push({
      type: "stage_2",
      sentence_card: card.sentence_card,
      flashcard_id: card.flashcard_id
    });
    remaining -= 1;
  }

  for (const card of newStage1Cards) {
    if (remaining <= 0) break;
    sessionCards.push({
      type: "stage_1",
      sentence_card: card.sentence_card,
      flashcard_id: card.flashcard_id
    });
    remaining -= 1;
  }

  const session_id = randomUUID();

  return NextResponse.json({
    cards: sessionCards,
    total: sessionCards.length,
    session_id,
    lesson_id: currentLessonId,
    unit_id: currentLesson?.unitId ?? null,
    lesson_exhausted: lessonExhausted
  });
}
