import { levenshtein } from "@/lib/levenshtein";

export type EvaluateAnswerResult = "correct" | "typo" | "equivalent" | "close" | "wrong";

export interface EvaluateAnswerPayload {
  result: EvaluateAnswerResult;
  message: string;
  show_correct: boolean;
  correct_answer?: string;
}

const SYNONYM_GROUPS: string[][] = [
  ["hi", "hello", "hey", "greetings"],
  ["bye", "goodbye", "ciao", "farewell"],
  ["thanks", "thank you", "cheers"],
  ["yes", "yeah", "yep", "yup"],
  ["no", "nope", "nah"],
  ["ok", "okay", "alright"],
  ["please", "kindly"],
  ["sorry", "excuse me", "pardon"],
  ["good morning", "morning"],
  ["good evening", "evening"],
  ["good night", "night"],
  ["how are you", "how do you do", "how are things"],
  ["i am", "i'm"],
  ["my name is", "i am called", "i go by"],
  ["to hope", "hope"],
  ["to be", "be"],
  ["to have", "have"],
  ["to want", "want", "to wish", "wish"],
  ["to like", "like", "to enjoy", "enjoy"],
  ["to go", "go"],
  ["to come", "come"],
  ["dad", "father", "papa"],
  ["mom", "mother", "mum", "mama"]
];

function normPhrase(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Tier 1: instant client-side checks. Returns null if the answer should be sent to `/api/evaluate`.
 */
export function evaluateClientTier1(typed: string, translationEn: string): EvaluateAnswerPayload | null {
  const correctRaw = translationEn.trim();
  if (!correctRaw) return null;

  const correct = correctRaw.toLowerCase().trim();
  const input = typed.toLowerCase().trim();

  if (input === correct) {
    return { result: "correct", message: "", show_correct: false };
  }

  if (levenshtein(input, correct) <= 2 && input.length > 3) {
    return {
      result: "typo",
      message: "Small typo — almost perfect!",
      show_correct: false
    };
  }

  const inN = normPhrase(typed);
  const corN = normPhrase(correctRaw);
  const isSynonym = SYNONYM_GROUPS.some((group) => {
    const gn = group.map(normPhrase);
    return gn.includes(inN) && gn.includes(corN);
  });

  if (isSynonym) {
    return {
      result: "equivalent",
      message: `Both work! "${typed.trim()}" and "${correctRaw}" mean the same thing.`,
      show_correct: false
    };
  }

  return null;
}

export type KnownLanguageForEvaluate = { language: string; cefr_level: string };

/** Tier 2: AI evaluation via existing API. */
export async function evaluateAnswerFromApi(
  typed: string,
  wordSurface: string,
  translationEn: string,
  languageCode: string,
  knownLanguages: KnownLanguageForEvaluate[]
): Promise<EvaluateAnswerPayload> {
  const res = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      word: wordSurface,
      typed_answer: typed,
      correct_answer: translationEn.trim(),
      language_code: languageCode,
      known_languages: knownLanguages
    })
  });
  const data = (await res.json().catch(() => ({}))) as EvaluateAnswerPayload & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Could not check your answer.");
  }
  if (!data.result) {
    throw new Error("Unexpected response from server.");
  }
  return {
    result: data.result,
    message: typeof data.message === "string" ? data.message : "",
    show_correct: Boolean(data.show_correct),
    correct_answer: data.correct_answer
  };
}
