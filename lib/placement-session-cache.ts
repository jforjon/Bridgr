import { createClient } from "@/lib/supabase/server";

export type PlacementQuestionType =
  | "vocabulary"
  | "grammar"
  | "comprehension"
  | "reading"
  | "writing";

export type PlacementCefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface PlacementStoredQuestion {
  id: string;
  type: PlacementQuestionType;
  cefr_level: PlacementCefrLevel;
  /** When missing, submit route falls back to \`${type}_${cefr_level}\` for weak_areas. */
  topic_key?: string;
  prompt: string;
  context?: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
}

export interface PlacementSessionPayload {
  userId: string;
  language_code: string;
  language_name: string;
  questions: PlacementStoredQuestion[];
  expiresAt: number;
}

const TTL_MS = 2 * 60 * 60 * 1000;

export async function createPlacementSession(
  payload: Omit<PlacementSessionPayload, "expiresAt">
): Promise<string> {
  const supabase = createClient();
  const expiresAtIso = new Date(Date.now() + TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("placement_sessions")
    .insert({
      user_id: payload.userId,
      language_code: payload.language_code,
      language_name: payload.language_name,
      questions: payload.questions,
      expires_at: expiresAtIso
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not create placement session.");
  }

  return data.id;
}

export async function getPlacementSession(test_session_id: string): Promise<PlacementSessionPayload | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("placement_sessions")
    .select("user_id, language_code, language_name, questions, expires_at")
    .eq("id", test_session_id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) return null;
  if (!data) return null;

  return {
    userId: data.user_id,
    language_code: data.language_code,
    language_name: data.language_name,
    questions: (data.questions ?? []) as PlacementStoredQuestion[],
    expiresAt: new Date(data.expires_at).getTime()
  };
}

export async function deletePlacementSession(test_session_id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("placement_sessions").delete().eq("id", test_session_id);
  if (error) {
    console.warn("[placement/session] delete failed:", error.message);
  }
}
