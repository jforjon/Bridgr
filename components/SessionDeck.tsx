"use client";

import Link from "next/link";
import { IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FalseFriendAlert from "@/components/FalseFriendAlert";
import SessionStage1Card from "@/components/session/SessionStage1Card";
import SessionStage2Card from "@/components/session/SessionStage2Card";
import type { CardOutcome, SessionCard } from "@/types";

const NAILED_PHRASE_TEMPLATES = [
  (word: string) => `You really know '${word}' now.`,
  (word: string) => `'${word}' — locked in.`,
  (word: string) => `Nice. '${word}' stuck this session.`,
  (word: string) => `That '${word}' moment paid off.`,
  (word: string) => `'${word}' is yours.`
];

function nailedPhrase(word: string, index: number): string {
  return NAILED_PHRASE_TEMPLATES[index % NAILED_PHRASE_TEMPLATES.length](word);
}

export interface SessionDeckProps {
  cards: SessionCard[];
  languageCode: string;
  languageName: string;
  /** Lesson the session's new cards came from; used to mark it complete. */
  lessonId?: string | null;
  /** Unit of that lesson; used to pre-generate the next unit's cards. */
  unitId?: string | null;
  /** True when this session introduces the lesson's last new cards. */
  lessonExhausted?: boolean;
}

type WeekStats = {
  weekly_streak: number;
  sessions_this_week: number;
  weekly_goal: number;
  week_complete: boolean;
};

export default function SessionDeck({
  cards,
  languageCode,
  languageName,
  lessonId = null,
  unitId = null,
  lessonExhausted = false
}: SessionDeckProps) {
  const [index, setIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [continueLoading, setContinueLoading] = useState(false);
  const [error, setError] = useState("");
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null);

  const firstTryCorrectRef = useRef(0);
  const totalGradedRef = useRef(0);
  const nailedWordsRef = useRef<string[]>([]);
  const streakFiredRef = useRef(false);
  const progressionFiredRef = useRef(false);

  const current = cards[index] ?? null;
  const sessionComplete = cards.length > 0 && index >= cards.length;
  const progressPct =
    cards.length > 0 ? Math.min(100, (completedCount / cards.length) * 100) : 0;

  const gradedCardCount = useMemo(
    () => cards.filter((c) => c.type === "stage_1" || c.type === "stage_2").length,
    [cards]
  );

  useEffect(() => {
    if (!sessionComplete || streakFiredRef.current) return;
    streakFiredRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/streak/session", {
          method: "POST",
          credentials: "include"
        });
        if (!res.ok) return;
        const data = (await res.json()) as Partial<WeekStats>;
        if (
          typeof data.sessions_this_week === "number" &&
          typeof data.weekly_goal === "number"
        ) {
          setWeekStats({
            weekly_streak: data.weekly_streak ?? 0,
            sessions_this_week: data.sessions_this_week,
            weekly_goal: data.weekly_goal,
            week_complete: data.week_complete === true
          });
        }
      } catch (err) {
        console.error("[SessionDeck] streak session failed:", err);
      }
    })();
  }, [sessionComplete]);

  // Course progression: once the session that introduced the lesson's last new
  // cards is finished (or the lesson had nothing left to serve), mark the
  // lesson complete — which unlocks the next lesson/unit — and kick off card
  // generation for the following unit. Both calls are safe to repeat.
  const shouldAdvanceCourse =
    lessonExhausted && Boolean(lessonId) && (sessionComplete || cards.length === 0);

  useEffect(() => {
    if (!shouldAdvanceCourse || progressionFiredRef.current) return;
    progressionFiredRef.current = true;

    async function advanceCourse() {
      try {
        const res = await fetch("/api/lesson/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ lesson_id: lessonId })
        });
        if (!res.ok) {
          console.error("[SessionDeck] lesson complete failed:", await res.text());
          return;
        }
        if (unitId) {
          const triggerRes = await fetch("/api/cards/trigger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ current_unit_id: unitId })
          });
          if (!triggerRes.ok) {
            console.error("[SessionDeck] cards trigger failed:", await triggerRes.text());
          }
        }
      } catch (err) {
        console.error("[SessionDeck] course progression failed:", err);
      }
    }

    void advanceCourse();
  }, [shouldAdvanceCourse, lessonId, unitId]);

  const advanceCard = useCallback(() => {
    setCompletedCount((c) => c + 1);
    setIndex((i) => i + 1);
    setError("");
  }, []);

  const recordFirstTry = useCallback((outcome: CardOutcome, targetItem: string) => {
    totalGradedRef.current += 1;
    if (outcome === "solid") {
      firstTryCorrectRef.current += 1;
      const word = targetItem.trim();
      if (word && !nailedWordsRef.current.includes(word)) {
        nailedWordsRef.current.push(word);
      }
    }
  }, []);

  const submitSrs = useCallback(
    async (flashcardId: string, outcome: CardOutcome) => {
      setContinueLoading(true);
      setError("");
      try {
        const res = await fetch("/api/cards/srs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            flashcard_id: flashcardId,
            outcome,
            language_code: languageCode
          })
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not save progress.");
          return false;
        }
        return true;
      } catch {
        setError("Network error while saving progress.");
        return false;
      } finally {
        setContinueLoading(false);
      }
    },
    [languageCode]
  );

  const handleStage1Continue = useCallback(
    async (outcome: CardOutcome) => {
      if (!current || current.type !== "stage_1") return;
      recordFirstTry(outcome, current.sentence_card.target_item);
      const ok = await submitSrs(current.flashcard_id, outcome);
      if (ok) advanceCard();
    },
    [advanceCard, current, recordFirstTry, submitSrs]
  );

  const handleStage2Evaluated = useCallback(
    (outcome: CardOutcome) => {
      if (!current || current.type !== "stage_2") return;
      recordFirstTry(outcome, current.sentence_card.target_item);
    },
    [current, recordFirstTry]
  );

  const handleStage2Continue = useCallback(
    async (outcome: CardOutcome) => {
      if (!current || current.type !== "stage_2") return;
      const ok = await submitSrs(current.flashcard_id, outcome);
      if (ok) advanceCard();
    },
    [advanceCard, current, submitSrs]
  );

  if (cards.length === 0) {
    return (
      <main className="px-page flex min-h-screen flex-col items-center justify-center bg-app text-center">
        <p className="text-base font-semibold text-ink">Nothing to review right now</p>
        <p className="mt-2 max-w-xs text-sm text-ink-secondary">
          Your next cards will be ready once new material unlocks or reviews come due.
        </p>
        <Link href="/learn" className="btn-primary mt-8 w-full max-w-sm">
          Back to home
        </Link>
      </main>
    );
  }

  if (sessionComplete) {
    const firstTry = firstTryCorrectRef.current;
    const total = totalGradedRef.current || gradedCardCount;
    const nailed = nailedWordsRef.current;

    return (
      <main className="relative min-h-screen bg-app pb-36 pt-8 text-ink">
        <div className="fixed inset-x-0 top-0 z-50 h-[4px] bg-card-2">
          <div className="h-full w-full bg-accent-fill" />
        </div>

        <div className="px-page mx-auto max-w-lg pt-16">
          <p className="label-caps rise">Session complete</p>
          <h1 className="type-serif rise mt-3 text-[34px] font-medium leading-[1.15]" style={{ animationDelay: "60ms" }}>
            Good work — that counts.
          </h1>

          {total > 0 ? (
            <div className="ruled rise mt-8 flex gap-12 py-6" style={{ animationDelay: "130ms" }}>
              <div>
                <p className="type-serif text-[36px] font-medium leading-none text-ink">
                  {firstTry}
                  <span className="text-xl text-ink-tertiary">/{total}</span>
                </p>
                <p className="mt-2 text-[13px] text-ink-secondary">on the first try</p>
              </div>
              <div>
                <p className="type-serif text-[36px] font-medium leading-none text-ink">
                  {cards.length}
                </p>
                <p className="mt-2 text-[13px] text-ink-secondary">cards</p>
              </div>
            </div>
          ) : null}

          {nailed.length > 0 ? (
            <div className="rise mt-8" style={{ animationDelay: "200ms" }}>
              <p className="label-caps">Locked in this session</p>
              <ul className="mt-1 divide-y divide-[var(--border)] border-b border-line">
                {nailed.map((word, i) => (
                  <li key={word} className="py-3.5 text-[15px] text-ink">
                    {nailedPhrase(word, i)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {weekStats ? (
            <div className="mt-8 border-b border-line pb-6">
              <div className="flex items-center justify-between gap-6">
                <p className="text-sm text-ink-secondary">
                  {weekStats.week_complete
                    ? "Week goal met — anything more is a bonus."
                    : `${weekStats.sessions_this_week} of ${weekStats.weekly_goal} sessions this week`}
                </p>
                <div
                  className="progress-bar h-1 w-28 shrink-0"
                  aria-hidden
                >
                  <div
                    className="progress-bar__fill duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (weekStats.sessions_this_week / weekStats.weekly_goal) * 100
                      )}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <Link href="/learn" className="btn-primary mt-10 w-full">
            Done for today
          </Link>
          {!weekStats ? (
            <p className="mt-4 text-center text-[13px] text-ink-tertiary">
              This session counts toward your weekly goal.
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-app pb-32 text-ink">
      <div className="fixed inset-x-0 top-0 z-50 h-[4px] bg-card-2">
        <div
          className="h-full bg-accent-fill transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="px-page mx-auto flex max-w-lg items-center justify-between pt-4">
        <Link
          href="/learn"
          aria-label="Exit session"
          className="tap-target -ml-3 flex items-center justify-center text-ink-tertiary transition-colors duration-150 hover:text-ink"
        >
          <IconX size={20} stroke={1.5} aria-hidden />
        </Link>
        <p className="text-[13px] font-medium text-ink-tertiary">
          {Math.min(completedCount + 1, cards.length)} / {cards.length}
        </p>
        <span className="h-[44px] w-[44px]" aria-hidden />
      </div>

      {error ? <p className="px-page mt-6 text-center text-sm text-danger">{error}</p> : null}

      {current?.type === "false_friend_alert" ? (
        <FalseFriendAlert
          alert={current.alert}
          targetLanguageName={languageName}
          onDismiss={advanceCard}
        />
      ) : null}

      {current?.type === "stage_1" ? (
        <SessionStage1Card
          key={current.flashcard_id}
          sentenceCard={current.sentence_card}
          languageName={languageName}
          onContinue={handleStage1Continue}
          continueLoading={continueLoading}
        />
      ) : null}

      {current?.type === "stage_2" ? (
        <SessionStage2Card
          key={current.flashcard_id}
          sentenceCard={current.sentence_card}
          flashcardId={current.flashcard_id}
          languageCode={languageCode}
          languageName={languageName}
          onContinue={handleStage2Continue}
          onEvaluated={handleStage2Evaluated}
          continueLoading={continueLoading}
        />
      ) : null}
    </main>
  );
}
