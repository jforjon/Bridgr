"use client";

import { IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/client";
import { evaluateAnswerFromApi, evaluateClientTier1 } from "@/lib/evaluateAnswer";
import { getDueCards } from "@/lib/srs";
import type { Flashcard, KnownLanguage, LearningLanguage } from "@/types";
import type { EvaluateResult } from "@/components/VocabularyTypingDeck";

interface EvalPayload {
  result: EvaluateResult;
  message: string;
  show_correct: boolean;
  correct_answer?: string;
}

interface UnderstandPayload {
  hook: string;
}

type PostEvalUnderstand =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; paragraph: string }
  | { status: "error"; message: string };

export default function PracticeReviewPage() {
  const supabase = useMemo(() => createClient(), []);
  const [dataFetched, setDataFetched] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [evalResult, setEvalResult] = useState<EvalPayload | null>(null);
  const [postEvalUnderstand, setPostEvalUnderstand] = useState<PostEvalUnderstand>({ status: "idle" });
  const [checkLoading, setCheckLoading] = useState(false);
  const [srsLoading, setSrsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasLearningLanguage, setHasLearningLanguage] = useState(true);
  const [knownLanguageRows, setKnownLanguageRows] = useState<KnownLanguage[]>([]);
  const [targetLanguageCode, setTargetLanguageCode] = useState("es");

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Please log in first.");
      setLoading(false);
      return;
    }

    const [{ data: knownRows }, { data: learningRows, count: learningCount, error: learningCountError }] =
      await Promise.all([
        supabase.from("known_languages").select("*").eq("user_id", user.id),
        supabase
          .from("learning_languages")
          .select("*", { count: "exact" })
          .eq("user_id", user.id)
          .order("last_accessed_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: true })
      ]);

    setKnownLanguageRows((knownRows ?? []) as KnownLanguage[]);
    const learningTyped = (learningRows ?? []) as LearningLanguage[];
    const activeLanguage = learningTyped[0];
    if (activeLanguage?.language_code) {
      setTargetLanguageCode(activeLanguage.language_code);
    }

    if (!learningCountError) setHasLearningLanguage((learningCount ?? 0) > 0);

    try {
      const dueCards = await getDueCards(user.id, supabase, 20);
      const rawData = dueCards;
      console.log("RAW cards from DB:", rawData?.map((c) => c.word_id));
      console.log("[PracticeReview] raw dueCards from getDueCards", dueCards);
      const seen = new Set<string>();
      const unique = dueCards.filter((card) => {
        const wordText = card.words?.word;
        if (!wordText || seen.has(wordText)) return false;
        seen.add(wordText);
        return true;
      });
      setCards(unique);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load due cards.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (dataFetched) return;
    setDataFetched(true);
    void loadInitialData();
    // Intentional `[]`: run once per mount; `dataFetched` avoids duplicate fetch when Strict Mode remounts with state preserved.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadInitialData + supabase are stable for app lifetime
  }, []);

  useEffect(() => {
    console.log(
      "FINAL cards in state:",
      cards.map((c) => c.words?.word ?? (c as Flashcard & { word?: { word?: string } }).word?.word)
    );
  }, [cards]);

  const currentCard = useMemo(() => cards[index] ?? null, [cards, index]);
  const expectedEnglish = useMemo(
    () => (currentCard ? (currentCard.words?.translation ?? "").trim() : ""),
    [currentCard]
  );

  const knownForEvaluate = useMemo(
    () =>
      knownLanguageRows.map((k) => ({
        language: k.language_name,
        cefr_level: k.proficiency
      })),
    [knownLanguageRows]
  );

  const knownForUnderstand = useMemo(
    () =>
      knownLanguageRows.map((k) => ({
        language: k.language_name,
        code: k.language_code,
        cefr_level: k.proficiency
      })),
    [knownLanguageRows]
  );

  const answerSubtitleLine = useMemo(() => {
    if (!currentCard?.words) return expectedEnglish;
    const pos = currentCard.words.part_of_speech?.trim();
    if (expectedEnglish && pos) return `${expectedEnglish} · ${pos}`;
    return expectedEnglish;
  }, [currentCard, expectedEnglish]);

  useEffect(() => {
    setHintLevel(0);
    setTypedAnswer("");
    setSubmittedAnswer("");
    setEvalResult(null);
    setPostEvalUnderstand({ status: "idle" });
    setCheckLoading(false);
    setSrsLoading(false);
  }, [index]);

  const submitCheck = async () => {
    if (!currentCard || evalResult) return;
    setError("");
    try {
      const tier1 = evaluateClientTier1(typedAnswer, expectedEnglish);
      if (tier1) {
        setSubmittedAnswer(typedAnswer);
        setEvalResult(tier1);
        return;
      }

      setCheckLoading(true);
      const data = await evaluateAnswerFromApi(
        typedAnswer,
        currentCard.words?.word ?? "",
        expectedEnglish,
        targetLanguageCode,
        knownForEvaluate
      );
      setSubmittedAnswer(typedAnswer);
      setEvalResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error while checking.");
    } finally {
      setCheckLoading(false);
    }
  };

  useEffect(() => {
    if (!evalResult || !currentCard) {
      setPostEvalUnderstand({ status: "idle" });
      return;
    }
    if (evalResult.result !== "close" && evalResult.result !== "wrong") {
      setPostEvalUnderstand({ status: "idle" });
      return;
    }

    const ac = new AbortController();
    setPostEvalUnderstand({ status: "loading" });

    void (async () => {
      try {
        const res = await fetch("/api/understand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: ac.signal,
          body: JSON.stringify({
            word_id: currentCard.word_id,
            word: currentCard.words?.word ?? "",
            language_code: targetLanguageCode,
            translation: expectedEnglish,
            known_languages: knownForUnderstand
          })
        });
        const data = (await res.json().catch(() => ({}))) as UnderstandPayload & { error?: string };
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setPostEvalUnderstand({
            status: "error",
            message: data.error ?? "Could not load memory hook"
          });
          return;
        }
        const paragraph = (data.hook ?? "").trim();
        if (!paragraph) {
          setPostEvalUnderstand({ status: "error", message: "No memory hook available." });
          return;
        }
        setPostEvalUnderstand({ status: "ok", paragraph });
      } catch {
        if (ac.signal.aborted) return;
        setPostEvalUnderstand({ status: "error", message: "Network error." });
      }
    })();

    return () => ac.abort();
  }, [currentCard, evalResult, expectedEnglish, knownForUnderstand, targetLanguageCode]);

  useEffect(() => {
    if (hintLevel !== 2 || !currentCard || evalResult) return;

    const ac = new AbortController();
    setPostEvalUnderstand({ status: "loading" });

    void (async () => {
      try {
        const res = await fetch("/api/understand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: ac.signal,
          body: JSON.stringify({
            word_id: currentCard.word_id,
            word: currentCard.words?.word ?? "",
            language_code: targetLanguageCode,
            translation: expectedEnglish,
            known_languages: knownForUnderstand
          })
        });
        const data = (await res.json().catch(() => ({}))) as UnderstandPayload & { error?: string };
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setPostEvalUnderstand({
            status: "error",
            message: data.error ?? "Could not load memory hook"
          });
          return;
        }
        const paragraph = (data.hook ?? "").trim();
        if (!paragraph) {
          setPostEvalUnderstand({ status: "error", message: "No memory hook available." });
          return;
        }
        setPostEvalUnderstand({ status: "ok", paragraph });
      } catch {
        if (ac.signal.aborted) return;
        setPostEvalUnderstand({ status: "error", message: "Network error." });
      }
    })();

    return () => ac.abort();
  }, [currentCard, evalResult, expectedEnglish, hintLevel, knownForUnderstand, targetLanguageCode]);

  const handleContinue = async () => {
    if (!evalResult || !currentCard) return;
    const quality: 1 | 4 = evalResult.result === "wrong" ? 1 : 4;
    setSrsLoading(true);
    setError("");

    const response = await fetch("/api/srs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        flashcardId: currentCard.id,
        quality
      })
    });

    if (!response.ok) {
      setSrsLoading(false);
      setError("Failed to save review score.");
      return;
    }

    const nextCompletedCount = completedCount + 1;
    setCompletedCount(nextCompletedCount);

    if (nextCompletedCount >= 5 && index >= cards.length - 1) {
      await fetch("/api/streak/session", {
        method: "POST",
        credentials: "include"
      });
    }

    setIndex((current) => current + 1);
    setSrsLoading(false);
  };

  const handleContinueAfterReveal = async () => {
    if (!currentCard) return;
    setSrsLoading(true);
    setError("");

    const response = await fetch("/api/srs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        flashcardId: currentCard.id,
        quality: 1
      })
    });

    if (!response.ok) {
      setSrsLoading(false);
      setError("Failed to save review score.");
      return;
    }

    const nextCompletedCount = completedCount + 1;
    setCompletedCount(nextCompletedCount);

    if (nextCompletedCount >= 5 && index >= cards.length - 1) {
      await fetch("/api/streak/session", {
        method: "POST",
        credentials: "include"
      });
    }

    setIndex((current) => current + 1);
    setHintLevel(0);
    setSrsLoading(false);
  };

  if (loading) {
    return (
      <>
        <main className="bg-teal-900 p-6 pb-28 text-sm text-teal-200">Loading due cards...</main>
        <BottomNav activeTab="practice" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="bg-teal-900 p-6 pb-28 text-sm text-red-400">{error}</main>
        <BottomNav activeTab="practice" hasLearningLanguage={hasLearningLanguage} />
      </>
    );
  }

  if (!cards.length || !currentCard) {
    return (
      <>
        <main className="grid min-h-screen place-items-center bg-teal-900 p-6 pb-28 text-center">
          <div>
            <h1 className="font-sans text-3xl font-extrabold text-white">All caught up</h1>
            <p className="mt-2 text-sm text-teal-200">Come back tomorrow for your next review</p>
            <Link
              href="/learn"
              className="mt-6 inline-flex rounded-full bg-lime-300 px-6 py-3 text-sm font-extrabold text-lime-700"
            >
              Back to home
            </Link>
          </div>
        </main>
        <BottomNav activeTab="practice" hasLearningLanguage={hasLearningLanguage} />
      </>
    );
  }

  const progressCurrent = Math.min(index + 1, cards.length);
  const progressPct = cards.length > 0 ? (progressCurrent / cards.length) * 100 : 0;
  const showComplete = false;

  const evalCorrect =
    evalResult &&
    (evalResult.result === "correct" ||
      evalResult.result === "typo" ||
      evalResult.result === "equivalent");
  const evalNeedsWarning =
    evalResult && (evalResult.result === "wrong" || evalResult.result === "close");

  return (
    <main className="min-h-screen bg-teal-900 pb-24 text-[#e8f5f2]">
      <div className="fixed inset-x-0 top-0 z-40 bg-teal-900">
        <div className="mx-auto max-w-2xl border-b border-teal-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/practice"
              aria-label="Exit review"
              className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#1a3d38] text-[#8fbfb8] transition hover:opacity-90"
            >
              <IconX size={18} stroke={1.75} />
            </Link>
            <p className="text-center text-[13px] font-bold text-[#8fbfb8]">
              {`${progressCurrent} / ${cards.length}`}
            </p>
            <span className="h-[36px] w-[36px] shrink-0" aria-hidden />
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-teal-700">
            <div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-20 text-center">
        <h2 className="text-5xl font-extrabold text-white">{currentCard.words?.word ?? "Word"}</h2>

        {!evalResult ? (
          <>
            {hintLevel < 2 ? (
              <>
                <p className="mt-8 text-left text-xs font-bold uppercase tracking-wider text-teal-300">
                  Type the English translation
                </p>
                <input
                  type="text"
                  value={typedAnswer}
                  onChange={(event) => setTypedAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitCheck();
                    }
                  }}
                  placeholder="Type the English translation"
                  className="mt-2 w-full rounded-lg border border-teal-400 bg-teal-850 px-5 py-4 text-lg text-white outline-none placeholder:text-teal-300 focus:border-lime-300"
                />
                {checkLoading ? (
                  <p className="mt-1 text-left text-xs text-teal-300">Checking...</p>
                ) : null}
              </>
            ) : null}
            {hintLevel === 1 ? (
              <p className="mt-1 text-left text-sm font-bold text-[#ffd166]">
                First letter: {Array.from(expectedEnglish)[0] ?? ""}
              </p>
            ) : null}
            {hintLevel === 2 ? (
              <p className="mt-1 text-left text-sm font-bold text-[#ffd166]">Answer: {expectedEnglish}</p>
            ) : null}
            {hintLevel < 2 ? (
              <div className="mt-2 text-left">
                <button
                  type="button"
                  onClick={() => setHintLevel((level) => (level === 0 ? 1 : 2))}
                  className="border-0 bg-transparent p-0 text-sm text-teal-200 underline"
                >
                  {hintLevel === 0 ? "Show first letter" : "Reveal answer"}
                </button>
              </div>
            ) : null}
            {hintLevel === 2 ? (
              <div className="mt-4 rounded-[12px] bg-[rgba(127,255,95,0.1)] px-4 py-[14px] text-left text-[14px] font-semibold text-lime-300">
                <span aria-hidden>💡 </span>
                {postEvalUnderstand.status === "loading" ? (
                  <span className="text-lime-300/80">Loading tip…</span>
                ) : postEvalUnderstand.status === "ok" ? (
                  postEvalUnderstand.paragraph
                ) : postEvalUnderstand.status === "error" ? (
                  <span className="text-lime-300/90">{postEvalUnderstand.message}</span>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-8">
            <div className="my-4 border-t border-teal-400/40" />
            <p className="text-[28px] font-extrabold text-lime-300">{expectedEnglish}</p>
            <p className="mt-1 text-[13px] text-[#8fbfb8]">{answerSubtitleLine}</p>

            {evalCorrect ? (
              <div className="mt-4 rounded-[12px] bg-[rgba(127,255,95,0.1)] px-4 py-[13px] text-center text-[15px] font-bold text-lime-300">
                ✓ Correct
              </div>
            ) : null}

            {evalNeedsWarning ? (
              <div className="mt-4 rounded-[12px] bg-[rgba(255,209,102,0.12)] px-4 py-[13px] text-center text-[15px] font-bold text-[#ffd166]">
                <span>⚠ Not quite — you answered </span>
                <span className="font-bold italic">&quot;{submittedAnswer}&quot;</span>
              </div>
            ) : null}

            {evalNeedsWarning &&
            (postEvalUnderstand.status === "loading" ||
              postEvalUnderstand.status === "ok" ||
              postEvalUnderstand.status === "error") ? (
              <div className="mt-4 rounded-[12px] bg-[rgba(127,255,95,0.1)] px-4 py-[14px] text-left text-[14px] font-semibold text-lime-300">
                <span aria-hidden>💡 </span>
                {postEvalUnderstand.status === "loading" ? (
                  <span className="text-lime-300/80">Loading tip…</span>
                ) : postEvalUnderstand.status === "ok" ? (
                  postEvalUnderstand.paragraph
                ) : (
                  <span className="text-lime-300/90">{postEvalUnderstand.message}</span>
                )}
              </div>
            ) : null}

            {evalResult.result === "equivalent" && evalResult.message.trim() && !evalNeedsWarning ? (
              <div className="mt-3 rounded-[12px] bg-[rgba(127,255,95,0.1)] px-4 py-[13px] text-center text-[14px] font-semibold italic text-lime-300">
                {evalResult.message}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-teal-700 bg-teal-900 px-4 py-4">
        <div className="mx-auto max-w-2xl">
          {!evalResult ? (
            <button
              type="button"
              onClick={() => (hintLevel === 2 ? void handleContinueAfterReveal() : void submitCheck())}
              disabled={hintLevel === 2 ? srsLoading : checkLoading}
              className="w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700 disabled:opacity-50"
            >
              {hintLevel === 2 ? "Next" : "Check"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={srsLoading}
              className="w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700 disabled:opacity-50"
            >
              Next
            </button>
          )}
        </div>
      </div>
      {showComplete && <BottomNav activeTab="practice" hasLearningLanguage={hasLearningLanguage} />}
    </main>
  );
}
