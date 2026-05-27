"use client";

import { IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { evaluateAnswerFromApi, evaluateClientTier1 } from "@/lib/evaluateAnswer";
import { SUPPORTED_LANGUAGES, type KnownLanguage } from "@/types";

export interface VocabDeckItem {
  word_id: string;
  /** Surface form in the target language (shown on the card). */
  word: string;
  /** English gloss — expected typed answer (alias of translation_en when present). */
  translation: string;
  /** Explicit English answer; falls back to `translation` if omitted. */
  translation_en?: string;
  flashcard_id: string;
  /** Optional; used by lesson intro and badges. */
  part_of_speech?: string | null;
}

/** Practice: first tap reveals first letter only; no full-word reveal. */
type PracticeReveal = "hidden" | "first_letter";

export type EvaluateResult = "correct" | "typo" | "equivalent" | "close" | "wrong";

interface EvalPayload {
  result: EvaluateResult;
  message: string;
  show_correct: boolean;
  correct_answer?: string;
}

interface UnderstandPayload {
  hook: string;
  source_language?: string;
  type?: "cognate" | "similar" | "mnemonic" | "etymology";
}

function cycleRevealPractice(s: PracticeReveal): PracticeReveal {
  if (s === "hidden") return "first_letter";
  return "first_letter";
}


function memoryHookParagraph(data: UnderstandPayload): string {
  return (data.hook ?? "").trim();
}

type PostEvalUnderstand =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; paragraph: string }
  | { status: "error"; message: string };

export interface VocabularyTypingDeckProps {
  items: VocabDeckItem[];
  languageCode: string;
  knownLanguageRows: KnownLanguage[];
  exitHref: string;
  exitLabel?: string;
  hasLearningLanguage?: boolean;
  /** Hide bottom navigation (e.g. during an in-app lesson). */
  hideBottomNav?: boolean;
  /** When set, sent to `/api/flashcards/upsert` on Continue (before `/api/srs`). */
  lessonId?: string;
  /** Called on the last card when finishing the deck (after SRS if upsert succeeded). */
  onSessionComplete?: () => Promise<void>;
  /**
   * When true, after the last card’s Continue flow we show a completion screen;
   * `onSessionComplete` runs when the learner taps the primary CTA (not immediately).
   */
  showLessonCompletionScreen?: boolean;
  /** Fires after each word’s Continue (once per card), with the evaluation result. */
  onWordPracticeResult?: (result: EvaluateResult) => void;
  /** When set with `showLessonCompletionScreen`, parent handles completion UI instead of the deck. */
  onLessonDeckFinished?: () => void;
  /** Pre-fetched `/api/understand` payloads keyed by `word_id` (e.g. lesson intro batch). */
  prefetchedMemoryHooks?: Record<
    string,
    { hook: string; type?: string; source_language?: string }
  >;
}

export default function VocabularyTypingDeck({
  items,
  languageCode,
  knownLanguageRows,
  exitHref,
  exitLabel = "Exit",
  hasLearningLanguage = true,
  hideBottomNav = false,
  lessonId,
  onSessionComplete,
  showLessonCompletionScreen = false,
  onWordPracticeResult,
  onLessonDeckFinished,
  prefetchedMemoryHooks
}: VocabularyTypingDeckProps) {
  const [index, setIndex] = useState(0);
  const [lessonCompletionVisible, setLessonCompletionVisible] = useState(false);
  const [finishLessonLoading, setFinishLessonLoading] = useState(false);
  const [revealState, setRevealState] = useState<PracticeReveal>("hidden");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [evalResult, setEvalResult] = useState<EvalPayload | null>(null);
  const [postEvalUnderstand, setPostEvalUnderstand] = useState<PostEvalUnderstand>({ status: "idle" });
  const [checkLoading, setCheckLoading] = useState(false);
  const [srsLoading, setSrsLoading] = useState(false);
  const [understandOpen, setUnderstandOpen] = useState(false);
  const [understandData, setUnderstandData] = useState<UnderstandPayload | null>(null);
  const [understandLoading, setUnderstandLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  /** Session summary for completion screen only (mirrors outcomes passed to `onWordPracticeResult`). */
  const sessionStatsRef = useRef({ correct: 0, review: 0, missed: 0 });
  const deckStatsKey = useMemo(() => items.map((i) => i.word_id).join("|"), [items]);

  const current = useMemo(() => items[index] ?? null, [items, index]);
  /** English gloss the learner should type (database primary answer language). */
  const expectedEnglish = useMemo(
    () => (current ? (current.translation_en ?? current.translation).trim() : ""),
    [current]
  );
  const sessionComplete = items.length > 0 && index >= items.length;
  const progressPct = items.length > 0 ? ((index + 1) / items.length) * 100 : 0;

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

  useEffect(() => {
    setRevealState("hidden");
    setTypedAnswer("");
    setSubmittedAnswer("");
    setEvalResult(null);
    setPostEvalUnderstand({ status: "idle" });
    setCheckLoading(false);
    setSrsLoading(false);
    setUnderstandOpen(false);
    setUnderstandData(null);
    setUnderstandLoading(false);
  }, [index]);

  useEffect(() => {
    sessionStatsRef.current = { correct: 0, review: 0, missed: 0 };
  }, [deckStatsKey]);

  useEffect(() => {
    if (!current || evalResult) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [current, evalResult]);

  const handleNextWord = useCallback(() => {
    setEvalResult(null);
    setSubmittedAnswer("");
    setPostEvalUnderstand({ status: "idle" });
    setRevealState("hidden");
    setTypedAnswer("");
    setIndex((i) => i + 1);
  }, []);

  /** After Continue: last-card completion, or advance index (SRS may have been skipped). */
  const finishContinueFlow = useCallback(
    async (practiceResult: EvaluateResult) => {
      onWordPracticeResult?.(practiceResult);
      if (practiceResult === "correct" || practiceResult === "typo" || practiceResult === "equivalent") {
        sessionStatsRef.current.correct += 1;
      } else if (practiceResult === "close") {
        sessionStatsRef.current.review += 1;
      } else if (practiceResult === "wrong") {
        sessionStatsRef.current.missed += 1;
      }
      const isLast = index === items.length - 1;
      if (isLast && onSessionComplete) {
        if (showLessonCompletionScreen) {
          if (onLessonDeckFinished) {
            onLessonDeckFinished();
            return;
          }
          setLessonCompletionVisible(true);
          return;
        }
        try {
          await onSessionComplete();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save lesson progress.");
          return;
        }
        return;
      }
      handleNextWord();
    },
    [
      handleNextWord,
      index,
      items.length,
      onLessonDeckFinished,
      onSessionComplete,
      onWordPracticeResult,
      showLessonCompletionScreen
    ]
  );

  const submitCheck = async () => {
    if (!current || evalResult) return;
    setError("");
    try {
      const tier1 = evaluateClientTier1(typedAnswer, expectedEnglish);
      if (tier1) {
        setSubmittedAnswer(typedAnswer);
        setEvalResult({
          result: tier1.result,
          message: tier1.message,
          show_correct: tier1.show_correct,
          correct_answer: tier1.correct_answer
        });
        return;
      }

      setCheckLoading(true);
      const data = await evaluateAnswerFromApi(
        typedAnswer,
        current.word,
        expectedEnglish,
        languageCode,
        knownForEvaluate
      );
      setSubmittedAnswer(typedAnswer);
      setEvalResult({
        result: data.result,
        message: data.message,
        show_correct: data.show_correct,
        correct_answer: data.correct_answer
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error while checking.");
    } finally {
      setCheckLoading(false);
    }
  };

  useEffect(() => {
    if (!evalResult || !current) {
      setPostEvalUnderstand({ status: "idle" });
      return;
    }
    if (evalResult.result !== "close" && evalResult.result !== "wrong") {
      setPostEvalUnderstand({ status: "idle" });
      return;
    }

    const prefetched = prefetchedMemoryHooks?.[current.word_id];
    const preParagraph = memoryHookParagraph({ hook: prefetched?.hook ?? "" });
    if (preParagraph.trim()) {
      setPostEvalUnderstand({ status: "ok", paragraph: preParagraph });
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
            word_id: current.word_id,
            word: current.word,
            language_code: languageCode,
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
        const paragraph = memoryHookParagraph({
          hook: data.hook ?? ""
        });
        if (!paragraph.trim()) {
          setPostEvalUnderstand({ status: "error", message: "No memory hook available." });
          return;
        }
        setPostEvalUnderstand({ status: "ok", paragraph });
      } catch (e) {
        if (ac.signal.aborted) return;
        setPostEvalUnderstand({ status: "error", message: "Network error." });
      }
    })();

    return () => ac.abort();
  }, [
    current?.word,
    current?.word_id,
    evalResult,
    expectedEnglish,
    languageCode,
    knownForUnderstand,
    prefetchedMemoryHooks
  ]);

  const openUnderstand = async () => {
    if (!current) return;
    setUnderstandOpen(true);
    const prefetched = prefetchedMemoryHooks?.[current.word_id];
    const preHook = memoryHookParagraph({ hook: prefetched?.hook ?? "" });
    if (preHook) {
      const t = prefetched?.type;
      const hookType =
        t === "cognate" || t === "similar" || t === "mnemonic" || t === "etymology" ? t : undefined;
      setUnderstandData({
        hook: prefetched?.hook ?? preHook,
        source_language: prefetched?.source_language,
        type: hookType
      });
      setUnderstandLoading(false);
      return;
    }
    setUnderstandData(null);
    setUnderstandLoading(true);
    try {
      const res = await fetch("/api/understand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          word_id: current.word_id,
          word: current.word,
          language_code: languageCode,
          translation: expectedEnglish,
          known_languages: knownForUnderstand
        })
      });
      const data = (await res.json().catch(() => ({}))) as UnderstandPayload & { error?: string };
      if (!res.ok) {
        setUnderstandData({ hook: data.error ?? "Could not load explanation." });
        return;
      }
      setUnderstandData({
        hook: data.hook ?? "",
        source_language: data.source_language,
        type: data.type
      });
    } catch {
      setUnderstandData({ hook: "Network error." });
    } finally {
      setUnderstandLoading(false);
    }
  };

  const handleContinueAfterEval = async () => {
    if (!evalResult || !current) return;
    const quality: 1 | 4 = evalResult.result === "wrong" ? 1 : 4;
    setSrsLoading(true);
    setError("");
    try {
      const upsertBody: Record<string, string> = {
        word_id: current.word_id,
        language_code: languageCode
      };
      if (lessonId?.trim()) upsertBody.lesson_id = lessonId.trim();

      const upsertRes = await fetch("/api/flashcards/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(upsertBody)
      });
      const upsertData = (await upsertRes.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };

      if (!upsertRes.ok || !upsertData.id) {
        console.warn("[VocabularyTypingDeck] /api/flashcards/upsert failed before SRS; skipping SRS", {
          status: upsertRes.status,
          error: upsertData.error
        });
        await finishContinueFlow(evalResult.result);
        return;
      }

      const srsRes = await fetch("/api/srs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ flashcardId: upsertData.id, quality })
      });
      if (!srsRes.ok) {
        const err = (await srsRes.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "Could not save review.");
        return;
      }
      await finishContinueFlow(evalResult.result);
    } catch {
      setError("Network error while saving progress.");
    } finally {
      setSrsLoading(false);
    }
  };

  const firstLetterOfAnswer = useMemo(() => {
    if (!expectedEnglish) return "";
    return Array.from(expectedEnglish)[0] ?? "";
  }, [expectedEnglish]);

  const languageDisplayName = useMemo(() => {
    const found = SUPPORTED_LANGUAGES.find((l) => l.code === languageCode.toLowerCase());
    if (found) return found.name;
    if (!languageCode) return "Language";
    return languageCode.charAt(0).toUpperCase() + languageCode.slice(1);
  }, [languageCode]);

  const prefetchHookText = useMemo(() => {
    const h = prefetchedMemoryHooks?.[current?.word_id ?? ""]?.hook?.trim() ?? "";
    return h;
  }, [current?.word_id, prefetchedMemoryHooks]);

  const answerSubtitleLine = useMemo(() => {
    const primary = expectedEnglish;
    const raw = (current?.translation ?? "").trim();
    if (raw && raw !== primary) return `${primary} · ${raw}`;
    return primary;
  }, [current?.translation, expectedEnglish]);

  if (items.length === 0) {
    return null;
  }

  if (lessonCompletionVisible && onSessionComplete) {
    return (
      <>
        <main className="min-h-screen bg-[var(--bg)] px-5 pb-32 pt-20 text-[var(--text-primary)]">
          <div className="mx-auto max-w-lg text-center">
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">Lesson complete</h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              You&apos;ve practiced every word in this lesson. Save your progress and return to your
              course.
            </p>
            {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
            <button
              type="button"
              disabled={finishLessonLoading}
              className="mt-10 w-full rounded-pill bg-[#BFFF00] py-[14px] text-[15px] font-extrabold text-[#2A3800] hover:bg-[#A8E000] disabled:opacity-30"
              onClick={() => {
                void (async () => {
                  setFinishLessonLoading(true);
                  setError("");
                  try {
                    await onSessionComplete();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save lesson progress.");
                  } finally {
                    setFinishLessonLoading(false);
                  }
                })();
              }}
            >
              {finishLessonLoading ? "Saving…" : "Go to course"}
            </button>
          </div>
        </main>
        {!hideBottomNav ? (
          <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
        ) : null}
      </>
    );
  }

  if (sessionComplete || !current) {
    const s = sessionStatsRef.current;
    return (
      <>
        <main
          className="relative flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text-primary)]"
        >
          <div className="flex flex-1 flex-col items-center justify-center px-5 pb-36 text-center">
            <p className="mb-6 text-[48px] leading-none" aria-hidden>
              🎉
            </p>
            <h1 className="text-[22px] font-extrabold text-[var(--text-primary)]">Session done!</h1>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
              You reviewed {items.length} {items.length === 1 ? "word" : "words"} in {languageDisplayName}
            </p>
            <div className="mt-8 grid w-full max-w-lg grid-cols-3 gap-3">
              <div className="rounded-[14px] bg-[var(--card)] px-4 py-4 text-center">
                <p className="text-2xl font-extrabold text-[var(--accent)]">{s.correct}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  Correct
                </p>
              </div>
              <div className="rounded-[14px] bg-[var(--card)] px-4 py-4 text-center">
                <p className="text-2xl font-extrabold text-[#ffd166]">{s.review}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  Review
                </p>
              </div>
              <div className="rounded-[14px] bg-[var(--card)] px-4 py-4 text-center">
                <p className="text-2xl font-extrabold text-[var(--text-primary)]">{s.missed}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  Missed
                </p>
              </div>
            </div>
          </div>
          <div className="fixed inset-x-0 bottom-0 z-50 mx-5 mb-8">
            <Link
              href={exitHref}
              className="block w-full rounded-pill bg-[#BFFF00] py-[14px] text-center text-[15px] font-extrabold text-[#2A3800]"
            >
              Back to home
            </Link>
          </div>
        </main>
        {!hideBottomNav ? (
          <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
        ) : null}
      </>
    );
  }

  const evalCorrect =
    evalResult &&
    (evalResult.result === "correct" ||
      evalResult.result === "typo" ||
      evalResult.result === "equivalent");
  const evalNeedsWarning =
    evalResult && (evalResult.result === "wrong" || evalResult.result === "close");

  return (
    <>
      <main className="min-h-screen bg-[var(--bg)] pb-32 text-[var(--text-primary)]">
        <div className="sticky top-0 z-40 px-5 pt-4">
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--card-2)] px-5 py-4">
            <div className="flex items-center justify-between">
              <Link
                href={exitHref}
                aria-label={exitLabel}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--card-2)] text-[var(--text-secondary)] transition hover:opacity-90"
              >
                <IconX size={18} stroke={1.75} />
              </Link>
              <p className="text-center text-[13px] font-bold text-[var(--text-secondary)]">
                {`${index + 1} / ${items.length}`}
              </p>
              <span className="h-[36px] w-[36px] shrink-0" aria-hidden />
            </div>
            <div className="mt-3 h-[3px] w-full overflow-hidden rounded-pill bg-[var(--card-2)]">
              <div
                className="h-full rounded-pill bg-[#BFFF00] hover:bg-[#A8E000] transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {error ? (
          <p className="mx-5 mt-4 text-center text-sm text-red-400">{error}</p>
        ) : null}

        <div className="mx-5 mt-6 rounded-[22px] bg-[var(--card)] p-6">
          <div className="text-center">
            <button
              type="button"
              onClick={() => setRevealState((s) => cycleRevealPractice(s))}
              className="w-full outline-none"
            >
              <p className="mt-2 text-4xl font-black tracking-tight text-[var(--text-primary)]">
                {current.word}
              </p>
            </button>
            {current.part_of_speech?.trim() ? (
              <div className="mt-3 flex justify-center">
                <span className="inline-block rounded-full border border-[var(--border)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                  {current.part_of_speech}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                {languageDisplayName}
              </p>
            )}

            {!evalResult && prefetchHookText ? (
              <p className="mt-8 text-left text-sm font-medium leading-relaxed text-[var(--text-primary)]">
                <span className="text-[var(--accent)]" aria-hidden>
                  💡{" "}
                </span>
                {prefetchHookText}
              </p>
            ) : null}

            {!evalResult ? (
              <div className="mt-8">
                <input
                  ref={inputRef}
                  key={current.word_id}
                  type="text"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submitCheck();
                    }
                  }}
                  placeholder="Type the translation..."
                  autoFocus
                  className="mt-4 w-full rounded-full border-none bg-[var(--card-2)] px-5 py-3 text-sm font-medium text-[var(--text-secondary)] outline-none placeholder:text-[var(--text-secondary)] focus:outline-none"
                />
                {checkLoading ? (
                  <p className="mt-2 text-center text-xs text-[var(--text-secondary)]">Checking...</p>
                ) : null}
                {revealState === "hidden" ? (
                  <button
                    type="button"
                    onClick={() => setRevealState("first_letter")}
                    className="mt-3 block w-full border-0 bg-transparent p-0 text-center text-xs font-medium text-[var(--text-secondary)]"
                  >
                    Show first letter
                  </button>
                ) : null}
                {revealState === "first_letter" ? (
                  <p className="mt-3 text-center text-xs font-medium text-[var(--text-secondary)]">
                    Starts with {firstLetterOfAnswer || "…"}
                  </p>
                ) : null}
              </div>
            ) : null}

            {evalResult ? (
              <div className="mt-8">
                <div className="my-4 border-t border-[var(--border)]" />
                <div className="text-center">
                  <p className="text-[28px] font-extrabold text-[var(--accent)]">{expectedEnglish}</p>
                  <p className="mt-1 text-center text-[13px] text-[var(--text-secondary)]">
                    {answerSubtitleLine}
                  </p>
                </div>

                {evalCorrect ? (
                  <div className="mt-4 rounded-[12px] bg-[var(--card-2)] px-4 py-[13px] text-center text-[15px] font-bold text-[var(--accent)]">
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
                  <p className="mt-4 text-left text-sm font-medium leading-relaxed text-[var(--text-primary)]">
                    <span className="text-[var(--accent)]" aria-hidden>
                      💡{" "}
                    </span>
                    {postEvalUnderstand.status === "loading" ? (
                      <span className="text-[var(--text-secondary)]">Loading tip…</span>
                    ) : postEvalUnderstand.status === "ok" ? (
                      postEvalUnderstand.paragraph
                    ) : (
                      <span className="text-[var(--text-secondary)]">{postEvalUnderstand.message}</span>
                    )}
                  </p>
                ) : null}

                {evalResult.result === "equivalent" && evalResult.message.trim() && !evalNeedsWarning ? (
                  <p className="mt-3 text-center text-sm font-medium text-[var(--text-primary)]">
                    {evalResult.message}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {!understandOpen ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg)] p-5 pb-8">
          <button
            type="button"
            disabled={checkLoading || srsLoading}
            onClick={() => (!evalResult ? void submitCheck() : void handleContinueAfterEval())}
            className="w-full rounded-full bg-[#BFFF00] py-4 text-base font-extrabold text-[#2A3800] hover:bg-[#A8E000] disabled:opacity-30"
          >
            {!evalResult ? "Check" : "Next"}
          </button>
        </div>
      ) : null}

      {understandOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-black/40"
          role="presentation"
          onClick={() => !understandLoading && setUnderstandOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-[var(--border)] bg-[var(--card)] p-6 text-[var(--text-primary)] shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--card-2)]" aria-hidden />
            {understandLoading ? (
              <div className="space-y-6">
                <div>
                  <div className="mb-2 h-3 w-24 animate-pulse rounded bg-[var(--card-2)]" />
                  <div className="h-4 w-full animate-pulse rounded bg-[var(--card-2)]" />
                  <div className="mt-2 h-4 w-[85%] animate-pulse rounded bg-[var(--card-2)]" />
                </div>
              </div>
            ) : understandData ? (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Memory hook</p>
                <p className="text-sm font-semibold leading-relaxed text-[var(--text-secondary)]">{understandData.hook}</p>
              </div>
            ) : null}
            <button
              type="button"
              className="mt-8 w-full rounded-pill bg-[#BFFF00] py-[14px] text-[15px] font-extrabold text-[#2A3800]"
              onClick={() => setUnderstandOpen(false)}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      {!hideBottomNav ? (
        <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
      ) : null}
    </>
  );
}
