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

  const wordMetaLine = useMemo(() => {
    const lang = languageDisplayName.toUpperCase();
    const pos = current?.part_of_speech?.trim();
    if (pos) return `${lang} · ${pos.toUpperCase()}`;
    return lang;
  }, [current?.part_of_speech, languageDisplayName]);

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
        <main className="min-h-screen bg-teal-900 px-5 pb-32 pt-20 text-[#e8f5f2]">
          <div className="mx-auto max-w-lg text-center">
            <h1 className="text-2xl font-extrabold text-[#e8f5f2]">Lesson complete</h1>
            <p className="mt-3 text-sm leading-relaxed text-teal-200">
              You&apos;ve practiced every word in this lesson. Save your progress and return to your
              course.
            </p>
            {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
            <button
              type="button"
              disabled={finishLessonLoading}
              className="mt-10 w-full rounded-pill bg-lime-300 py-[14px] text-[15px] font-extrabold text-lime-700 disabled:opacity-50"
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
          className="relative flex min-h-screen flex-col bg-teal-900 text-[#e8f5f2]"
        >
          <div className="flex flex-1 flex-col items-center justify-center px-5 pb-36 text-center">
            <p className="mb-6 text-[48px] leading-none" aria-hidden>
              🎉
            </p>
            <h1 className="text-[22px] font-extrabold text-[#e8f5f2]">Session done!</h1>
            <p className="mt-2 text-[13px] text-teal-200">
              You reviewed {items.length} {items.length === 1 ? "word" : "words"} in {languageDisplayName}
            </p>
            <div className="mt-8 grid w-full max-w-lg grid-cols-3 gap-3">
              <div className="rounded-[14px] bg-teal-800 px-4 py-4 text-center">
                <p className="text-2xl font-extrabold text-lime-300">{s.correct}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-teal-200">
                  Correct
                </p>
              </div>
              <div className="rounded-[14px] bg-teal-800 px-4 py-4 text-center">
                <p className="text-2xl font-extrabold text-[#ffd166]">{s.review}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-teal-200">
                  Review
                </p>
              </div>
              <div className="rounded-[14px] bg-teal-800 px-4 py-4 text-center">
                <p className="text-2xl font-extrabold text-[#e8f5f2]">{s.missed}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-teal-200">
                  Missed
                </p>
              </div>
            </div>
          </div>
          <div className="fixed inset-x-0 bottom-0 z-50 mx-5 mb-8">
            <Link
              href={exitHref}
              className="block w-full rounded-pill bg-lime-300 py-[14px] text-center text-[15px] font-extrabold text-lime-700"
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
      <main className="min-h-screen bg-teal-900 pb-40 text-[#e8f5f2]">
        <div className="sticky top-0 z-40 px-5 pt-4">
          <div className="rounded-[20px] border border-teal-400 bg-teal-850 px-5 py-4">
            <div className="flex items-center justify-between">
              <Link
                href={exitHref}
                aria-label={exitLabel}
                className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#1a3d38] text-[#8fbfb8] transition hover:opacity-90"
              >
                <IconX size={18} stroke={1.75} />
              </Link>
              <p className="text-center text-[13px] font-bold text-muted">
                {`${index + 1} / ${items.length}`}
              </p>
              <span className="h-[36px] w-[36px] shrink-0" aria-hidden />
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-teal-700">
              <div
                className="h-full rounded-full bg-lime-300 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-5">
          {error ? <p className="mb-3 text-center text-sm text-red-400">{error}</p> : null}

          <div className="mt-32 text-center">
            <button
              type="button"
              onClick={() => setRevealState((s) => cycleRevealPractice(s))}
              className="w-full outline-none"
            >
              <p className="text-[40px] font-extrabold leading-tight text-white">{current.word}</p>
            </button>
            <p className="mt-2 text-center text-[12px] font-bold uppercase tracking-[0.08em] text-teal-300">
              {wordMetaLine}
            </p>
          </div>

          {!evalResult && prefetchHookText ? (
            <div className="mt-6 rounded-[12px] bg-[rgba(127,255,95,0.1)] px-4 py-[14px] text-left text-[14px] font-semibold text-lime-300">
              <span aria-hidden>💡 </span>
              {prefetchHookText}
            </div>
          ) : null}

          {!evalResult ? (
            <>
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
                className="mt-8 w-full rounded-[14px] border border-teal-400 bg-teal-850 px-[15px] py-[13px] text-[15px] font-semibold text-[#e8f5f2] outline-none placeholder:text-teal-300 focus:border-[1.5px] focus:border-lime-300"
              />
              {checkLoading ? (
                <p className="mt-2 text-center text-xs text-teal-300">Checking...</p>
              ) : null}
              {!evalResult && revealState === "hidden" ? (
                <p className="mt-2 text-center text-xs text-teal-300">Tap the word for a first-letter hint</p>
              ) : null}
              {revealState === "first_letter" ? (
                <p className="mt-2 text-center text-[13px] font-medium text-teal-200">
                  Starts with {firstLetterOfAnswer || "…"}
                </p>
              ) : null}
            </>
          ) : null}

          {evalResult ? (
            <div className="mt-6">
              <div className="my-4 border-t border-teal-400/40" />
              <div className="text-center">
                <p className="text-[28px] font-extrabold text-lime-300">{expectedEnglish}</p>
                <p className="mt-1 text-center text-[13px] text-muted">{answerSubtitleLine}</p>
              </div>

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
          ) : null}
        </div>
      </main>

      {!understandOpen ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-5 mb-8">
          <button
            type="button"
            disabled={checkLoading || srsLoading}
            onClick={() => (!evalResult ? void submitCheck() : void handleContinueAfterEval())}
            className="pointer-events-auto w-full rounded-pill bg-lime-300 py-[14px] px-7 text-[15px] font-extrabold text-lime-700 shadow-lg disabled:opacity-50"
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
            className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-teal-400 bg-teal-800 p-6 text-[#e8f5f2] shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-teal-600" aria-hidden />
            {understandLoading ? (
              <div className="space-y-6">
                <div>
                  <div className="mb-2 h-3 w-24 animate-pulse rounded bg-lime-300/10" />
                  <div className="h-4 w-full animate-pulse rounded bg-teal-850" />
                  <div className="mt-2 h-4 w-[85%] animate-pulse rounded bg-teal-850" />
                </div>
              </div>
            ) : understandData ? (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-teal-300">Memory hook</p>
                <p className="text-sm font-semibold leading-relaxed text-teal-100">{understandData.hook}</p>
              </div>
            ) : null}
            <button
              type="button"
              className="mt-8 w-full rounded-pill bg-lime-300 py-[14px] text-[15px] font-extrabold text-lime-700"
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
