"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CognateNoteLine from "@/components/session/CognateNoteLine";
import { cognateNoteForCard } from "@/lib/session-cognate";
import type { CardOutcome, SentenceCard } from "@/types";

type HintState = "none" | "first_letter" | "reveal";

type EvalResult = {
  outcome: CardOutcome;
  message: string | null;
  show_correct: boolean;
  correct_answer?: string;
};

type SentencePart = { type: "text" | "marker"; content: string };

function parseMarkedSentence(text: string): SentencePart[] {
  const parts: SentencePart[] = [];
  const re = /\[\[(.+?)\]\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", content: text.slice(last, match.index) });
    }
    parts.push({ type: "marker", content: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ type: "text", content: text.slice(last) });
  }
  return parts.length > 0 ? parts : [{ type: "text", content: text }];
}

interface SessionStage2CardProps {
  sentenceCard: SentenceCard;
  flashcardId: string;
  languageCode: string;
  languageName: string;
  onContinue: (outcome: CardOutcome) => Promise<void>;
  onEvaluated: (outcome: CardOutcome) => void;
  continueLoading: boolean;
}

export default function SessionStage2Card({
  sentenceCard,
  flashcardId,
  languageCode,
  languageName,
  onContinue,
  onEvaluated,
  continueLoading
}: SessionStage2CardProps) {
  const correctAnswer = sentenceCard.correct_answer.trim();
  const firstLetter = useMemo(
    () => (correctAnswer ? (Array.from(correctAnswer)[0] ?? "").toUpperCase() : ""),
    [correctAnswer]
  );

  const [hintState, setHintState] = useState<HintState>("none");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [hintPopoverOpen, setHintPopoverOpen] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);

  const sentenceParts = useMemo(
    () => parseMarkedSentence(sentenceCard.english_sentence_with_marker),
    [sentenceCard.english_sentence_with_marker]
  );
  const cognateNote = useMemo(() => cognateNoteForCard(sentenceCard), [sentenceCard]);

  useEffect(() => {
    setHintState("none");
    setTypedAnswer("");
    setEvalResult(null);
    setHintPopoverOpen(false);
    setCheckLoading(false);
    setError("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [sentenceCard.id]);

  useEffect(() => {
    if (hintState === "reveal") {
      setTypedAnswer(correctAnswer);
    }
  }, [hintState, correctAnswer]);

  useEffect(() => {
    if (!hintPopoverOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || markerRef.current?.contains(target)) {
        return;
      }
      setHintPopoverOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [hintPopoverOpen]);

  const submitCheck = useCallback(async () => {
    if (evalResult || !typedAnswer.trim()) return;
    setError("");
    setCheckLoading(true);
    try {
      const res = await fetch("/api/cards/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          flashcard_id: flashcardId,
          sentence_card_id: sentenceCard.id,
          typed_answer: typedAnswer,
          correct_answer: correctAnswer,
          language_code: languageCode,
          hint_used: hintState
        })
      });
      const data = (await res.json().catch(() => ({}))) as EvalResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not check answer.");
        return;
      }
      setEvalResult(data);
      onEvaluated(data.outcome);
    } catch {
      setError("Network error while checking.");
    } finally {
      setCheckLoading(false);
    }
  }, [
    correctAnswer,
    evalResult,
    flashcardId,
    hintState,
    languageCode,
    onEvaluated,
    sentenceCard.id,
    typedAnswer
  ]);

  const inputStateClass =
    evalResult && (evalResult.outcome === "solid" || evalResult.outcome === "struggle")
      ? "field-input--success"
      : "";

  return (
    <>
      <div className="px-page mx-auto max-w-lg pb-36 pt-10">
        <p className="relative mt-6 text-center font-serif text-2xl leading-relaxed text-ink">
          {sentenceParts.map((part, index) =>
            part.type === "text" ? (
              <span key={`t-${index}`}>{part.content}</span>
            ) : (
              <span key={`m-${index}`} className="relative inline">
                <span
                  ref={markerRef}
                  className="cursor-pointer border-b-2 border-dotted border-ink-tertiary pb-px transition-colors duration-150 hover:border-accent"
                  onClick={() => setHintPopoverOpen((open) => !open)}
                >
                  {part.content}
                </span>
                {hintPopoverOpen ? (
                  <div
                    ref={popoverRef}
                    className="menu absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2"
                  >
                    <button
                      type="button"
                      className="menu-item w-full text-left"
                      onClick={() => {
                        setHintState("first_letter");
                        setHintPopoverOpen(false);
                      }}
                    >
                      First letter: {firstLetter || "…"}
                    </button>
                    <button
                      type="button"
                      className="menu-item mt-1 w-full text-left"
                      onClick={() => {
                        setHintState("reveal");
                        setHintPopoverOpen(false);
                      }}
                    >
                      Reveal word
                    </button>
                  </div>
                ) : null}
              </span>
            )
          )}
        </p>

        <div className="mt-8">
          <input
            ref={inputRef}
            type="text"
            value={typedAnswer}
            readOnly={hintState === "reveal" && !evalResult}
            onChange={(e) => setTypedAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!evalResult) void submitCheck();
              }
            }}
            placeholder={`Type in ${languageName}...`}
            className={`field-input ${inputStateClass}`}
          />

          {hintState === "first_letter" && !evalResult ? (
            <p className="mt-2 text-sm text-warning">{firstLetter}…</p>
          ) : null}

          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

          {evalResult ? (
            <div className="mt-3">
              {evalResult.message ? (
                <p className="text-sm leading-relaxed text-ink-secondary">
                  {evalResult.message}
                </p>
              ) : null}
              {evalResult.show_correct && evalResult.correct_answer ? (
                <p className="mt-2 font-serif text-xl text-ink">
                  {evalResult.correct_answer}
                </p>
              ) : null}
              {cognateNote ? <CognateNoteLine note={cognateNote} /> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-app p-5 pb-8">
        <button
          type="button"
          disabled={
            evalResult
              ? continueLoading
              : !typedAnswer.trim() || checkLoading
          }
          className="btn-primary w-full disabled:opacity-30"
          onClick={() => {
            if (evalResult) {
              void onContinue(evalResult.outcome);
            } else {
              void submitCheck();
            }
          }}
        >
          {evalResult
            ? continueLoading
              ? "Saving…"
              : "Continue"
            : checkLoading
              ? "Checking…"
              : "Check"}
        </button>
      </div>

    </>
  );
}
