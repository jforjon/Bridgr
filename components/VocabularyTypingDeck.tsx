"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "@/components/BottomNav";
import type { KnownLanguage } from "@/types";

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

export type EvaluateResult = "correct" | "typo" | "close" | "wrong";

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

function revealHintTextPractice(s: PracticeReveal): string {
  if (s === "hidden") return "tap for first letter";
  return "";
}

function highlightDiffUser(userText: string, correctText: string): { char: string; bold: boolean }[] {
  const u = Array.from(userText);
  const c = Array.from(correctText);
  const n = Math.max(u.length, c.length);
  return Array.from({ length: n }, (_, i) => {
    const uch = u[i] ?? "";
    const cch = c[i] ?? "";
    return { char: uch === "" ? "\u00a0" : uch, bold: uch !== cch };
  });
}

function highlightDiffCorrect(userText: string, correctText: string): { char: string; bold: boolean }[] {
  const u = Array.from(userText);
  const c = Array.from(correctText);
  const n = Math.max(u.length, c.length);
  return Array.from({ length: n }, (_, i) => {
    const uch = u[i] ?? "";
    const cch = c[i] ?? "";
    return { char: cch === "" ? "\u00a0" : cch, bold: uch !== cch };
  });
}

function resultPillAfterCheck(result: EvaluateResult): { label: string; className: string } {
  const base = "inline-block rounded-full border px-3 py-1 text-xs font-medium";
  if (result === "correct" || result === "typo") {
    return { label: "Correct", className: `${base} bg-green-100 text-green-700 border-green-300` };
  }
  if (result === "close") {
    return {
      label: "You were close",
      className: `${base} bg-amber-50 text-amber-700 border-amber-200`
    };
  }
  return { label: "Not quite", className: `${base} bg-red-50 text-red-600 border-red-200` };
}

function memoryHookParagraph(data: UnderstandPayload): string {
  return (data.hook ?? "").trim();
}

function DiffLine({
  label,
  segments
}: {
  label: string;
  segments: { char: string; bold: boolean }[];
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm whitespace-pre-wrap break-all">
        {segments.map((s, i) => (
          <span key={i} className={s.bold ? "font-bold" : ""}>
            {s.char}
          </span>
        ))}
      </p>
    </div>
  );
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
  onLessonDeckFinished
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
    setCheckLoading(true);
    setError("");
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          word: current.word,
          typed_answer: typedAnswer,
          correct_answer: expectedEnglish,
          language_code: languageCode,
          known_languages: knownForEvaluate
        })
      });
      const data = (await res.json().catch(() => ({}))) as EvalPayload & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not check your answer.");
        return;
      }
      if (!data.result || !data.message) {
        setError("Unexpected response from server.");
        return;
      }

      setSubmittedAnswer(typedAnswer);
      setEvalResult({
        result: data.result,
        message: data.message,
        show_correct: Boolean(data.show_correct),
        correct_answer: data.correct_answer
      });
    } catch {
      setError("Network error while checking.");
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
    knownForUnderstand
  ]);

  const openUnderstand = async () => {
    if (!current) return;
    setUnderstandOpen(true);
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

  const firstGraphemes = useMemo(() => {
    if (!current) return { first: "", rest: "" };
    const arr = Array.from(current.word);
    return { first: arr[0] ?? "", rest: arr.slice(1).join("") };
  }, [current]);

  if (items.length === 0) {
    return null;
  }

  if (lessonCompletionVisible && onSessionComplete) {
    return (
      <>
        <main className="min-h-screen bg-[#F8FAF9] px-5 pb-32 pt-20">
          <div className="mx-auto max-w-lg text-center">
            <h1 className="font-serif text-2xl text-[#0F1A14]">Lesson complete</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              You&apos;ve practiced every word in this lesson. Continue to save your progress and
              return to your course.
            </p>
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            <button
              type="button"
              disabled={finishLessonLoading}
              className="mt-10 w-full rounded-2xl bg-[#2D6A4F] py-4 text-base font-semibold text-white disabled:opacity-50"
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
              {finishLessonLoading ? "Saving…" : "Continue to course"}
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
    return (
      <>
        <main className="p-6 pb-28">
          <h1 className="mt-8 text-2xl font-bold text-primary">Session complete</h1>
          <p className="mt-2 text-sm text-slate-600">
            Nice work. You reviewed all words in this learning session.
          </p>
        </main>
        {!hideBottomNav ? (
          <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[#F8FAF9] pb-32">
        <div className="fixed inset-x-0 top-0 z-40 bg-white">
          <div className="mx-auto max-w-2xl border-b border-slate-100 px-4 py-3">
            <div className="grid grid-cols-3 items-center">
              <Link href={exitHref} className="text-sm font-medium text-slate-600">
                {exitLabel}
              </Link>
              <p className="text-center text-sm text-slate-600">
                Word {index + 1} of {items.length}
              </p>
              <div />
            </div>
            <div className="mt-3 h-1 w-full bg-slate-100">
              <div className="h-full bg-[#2D6A4F]" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 pt-24">
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
            <button
              type="button"
              onClick={() => setRevealState((s) => cycleRevealPractice(s))}
              className="w-full text-center outline-none"
            >
              {revealState === "first_letter" ? (
                <span className="font-serif text-5xl font-normal">
                  <span className="text-amber-600">{firstGraphemes.first}</span>
                  <span className="text-slate-300">{firstGraphemes.rest}</span>
                </span>
              ) : (
                <span className="font-serif text-5xl font-normal text-[#0F1A14]">{current.word}</span>
              )}
            </button>
            {revealHintTextPractice(revealState) ? (
              <p className="mt-2 text-xs text-slate-400">{revealHintTextPractice(revealState)}</p>
            ) : null}

            {!evalResult ? (
              <>
                <p className="mt-8 text-left text-sm font-medium text-slate-600">
                  Type the English translation
                </p>
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
                  placeholder="Type the English translation"
                  autoFocus
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-4 text-lg text-[#0F1A14] outline-none ring-[#2D6A4F] focus:ring-2"
                />
                <div className="mt-2 text-left">
                  <button
                    type="button"
                    onClick={() => void openUnderstand()}
                    className="cursor-pointer border-0 bg-transparent p-0 text-left text-sm text-[#2D6A4F] underline"
                  >
                    Understand deeper
                  </button>
                </div>
              </>
            ) : null}
            {evalResult && (
              <div className="mt-8 text-left">
                {(() => {
                  const pill = resultPillAfterCheck(evalResult.result);
                  return <span className={pill.className}>{pill.label}</span>;
                })()}
                {evalResult.result === "correct" || evalResult.result === "typo" ? null : (
                  <>
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <DiffLine
                        label="You wrote:"
                        segments={highlightDiffUser(submittedAnswer, expectedEnglish)}
                      />
                      <div className="mt-3">
                        <DiffLine
                          label="Correct answer:"
                          segments={highlightDiffCorrect(submittedAnswer, expectedEnglish)}
                        />
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
                      <p className="mb-2 text-xs uppercase tracking-widest text-amber-600">REMEMBER IT</p>
                      {postEvalUnderstand.status === "loading" ? (
                        <div className="space-y-2" aria-busy>
                          <div className="h-3 w-[85%] animate-pulse rounded bg-amber-100/80" />
                          <div className="h-3 w-full animate-pulse rounded bg-amber-100/80" />
                          <div className="h-3 w-[70%] animate-pulse rounded bg-amber-100/80" />
                        </div>
                      ) : postEvalUnderstand.status === "ok" ? (
                        <p className="text-sm leading-relaxed text-amber-950">{postEvalUnderstand.paragraph}</p>
                      ) : postEvalUnderstand.status === "error" ? (
                        <p className="text-sm text-amber-900">{postEvalUnderstand.message}</p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {!understandOpen ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-white px-4 py-4">
          <div className="mx-auto max-w-2xl">
            {!evalResult ? (
              <button
                type="button"
                disabled={checkLoading}
                onClick={() => void submitCheck()}
                className="w-full rounded-2xl bg-[#2D6A4F] py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {checkLoading ? "Checking…" : "Check"}
              </button>
            ) : (
              <button
                type="button"
                disabled={srsLoading}
                onClick={() => void handleContinueAfterEval()}
                className="w-full rounded-2xl bg-[#2D6A4F] py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {srsLoading ? "Saving…" : "Continue"}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {understandOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-black/40"
          role="presentation"
          onClick={() => !understandLoading && setUnderstandOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
            {understandLoading ? (
              <div className="space-y-6">
                <div>
                  <div className="mb-2 h-3 w-24 animate-pulse rounded bg-amber-100" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  <div className="mt-2 h-4 w-[85%] animate-pulse rounded bg-slate-100" />
                </div>
                <div>
                  <div className="mb-2 h-3 w-20 animate-pulse rounded bg-blue-100" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                </div>
                <div>
                  <div className="mb-2 h-3 w-36 animate-pulse rounded bg-emerald-100" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ) : understandData ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Memory hook</p>
                <p className="text-sm leading-relaxed text-slate-700">{understandData.hook}</p>
              </div>
            ) : null}
            <button
              type="button"
              className="mt-8 w-full rounded-2xl bg-[#2D6A4F] py-3 text-sm font-semibold text-white"
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
