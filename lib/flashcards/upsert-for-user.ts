import type { SupabaseClient } from "@supabase/supabase-js";

export interface UpsertFlashcardParams {
  word_id: string;
  lesson_id?: string | null;
  language_code?: string | null;
}

/**
 * Upsert a flashcard for the given user (RLS-safe when `supabase` uses their session).
 * Uses unique (user_id, word_id); duplicates are ignored, then id is read back.
 */
export async function upsertUserFlashcard(
  supabase: SupabaseClient,
  userId: string,
  params: UpsertFlashcardParams
): Promise<{ id: string } | { error: string }> {
  const wordId = params.word_id?.trim();
  if (!wordId) {
    return { error: "word_id is required." };
  }

  const today = new Date().toISOString().split("T")[0];

  const row: Record<string, unknown> = {
    user_id: userId,
    word_id: wordId,
    ease_factor: 2.5,
    interval_days: 1,
    repetitions: 0,
    next_review_date: today
  };

  const lid = params.lesson_id?.trim();
  if (lid) row.lesson_id = lid;

  const lc = params.language_code?.trim()?.toLowerCase();
  if (lc) row.language_code = lc;

  const { error: upsertErr } = await supabase.from("flashcards").upsert(row, {
    onConflict: "user_id,word_id",
    ignoreDuplicates: true
  });

  if (upsertErr) {
    return { error: upsertErr.message };
  }

  const { data, error: selErr } = await supabase
    .from("flashcards")
    .select("id")
    .eq("user_id", userId)
    .eq("word_id", wordId)
    .maybeSingle();

  if (selErr || !data?.id) {
    return { error: selErr?.message ?? "Flashcard not found after upsert." };
  }

  return { id: data.id as string };
}
