import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flashcard, Word } from "@/types";

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

export interface SrsCardInput {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

export interface SrsReviewResult {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
}

export interface DueFlashcard extends Flashcard {
  words: Word;
}

export function calculateNextReview(
  quality: ReviewQuality,
  card: SrsCardInput
): SrsReviewResult {
  let repetitions = card.repetitions;
  let intervalDays = card.interval_days;
  let easeFactor = card.ease_factor;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(card.interval_days * card.ease_factor);
    }

    repetitions += 1;
    easeFactor =
      card.ease_factor +
      (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  }

  easeFactor = Math.max(1.3, Math.min(2.5, easeFactor));

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
  const nextReviewDateIso = nextReviewDate.toISOString().split("T")[0];

  return {
    ease_factor: easeFactor,
    interval_days: intervalDays,
    repetitions,
    next_review_date: nextReviewDateIso
  };
}

export async function getDueCards(
  userId: string,
  supabaseClient: SupabaseClient,
  limit = 20
): Promise<DueFlashcard[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabaseClient
    .from("flashcards")
    .select("*, words(*)")
    .eq("user_id", userId)
    .lte("next_review_date", today)
    .order("next_review_date", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as DueFlashcard[];
}
