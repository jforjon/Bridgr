"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/client";
import { getDueCards } from "@/lib/srs";
import type { Flashcard } from "@/types";

const QUALITY_OPTIONS = [
  { label: "Again", value: 1 },
  { label: "Hard", value: 2 },
  { label: "Good", value: 3 },
  { label: "Easy", value: 4 }
] as const;

export default function ReviewPage() {
  const supabase = createClient();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasLearningLanguage, setHasLearningLanguage] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please log in first.");
        setLoading(false);
        return;
      }

      const { count: learningCount, error: learningCountError } = await supabase
        .from("learning_languages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (!learningCountError) {
        setHasLearningLanguage((learningCount ?? 0) > 0);
      }

      try {
        const dueCards = await getDueCards(user.id, supabase, 20);
        setCards(dueCards);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load due cards.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [supabase]);

  const currentCard = useMemo(() => cards[index] ?? null, [cards, index]);

  const submitQuality = async (quality: 1 | 2 | 3 | 4) => {
    if (!currentCard) return;
    const response = await fetch("/api/srs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flashcardId: currentCard.id,
        quality
      })
    });

    if (!response.ok) {
      setError("Failed to save review score.");
      return;
    }

    setIndex((current) => current + 1);
    setRevealed(false);
  };

  if (loading) {
    return (
      <>
        <main className="p-6 pb-28 text-sm text-slate-600">Loading due cards...</main>
        <BottomNav activeTab="review" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="p-6 pb-28 text-sm text-red-600">{error}</main>
        <BottomNav activeTab="review" hasLearningLanguage={hasLearningLanguage} />
      </>
    );
  }

  if (!cards.length || !currentCard) {
    return (
      <>
        <main className="min-h-screen grid place-items-center p-6 pb-28 text-center">
          <div>
            <h1 className="font-serif text-3xl font-normal text-slate-900">All caught up</h1>
            <p className="mt-2 text-sm text-slate-500">Come back tomorrow for your next review</p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex rounded-2xl bg-[#2D6A4F] px-6 py-3 text-sm font-semibold text-white"
            >
              Back to dashboard
            </Link>
          </div>
        </main>
        <BottomNav activeTab="review" hasLearningLanguage={hasLearningLanguage} />
      </>
    );
  }

  const progressCurrent = Math.min(index + 1, cards.length);
  const progressPct = cards.length > 0 ? (progressCurrent / cards.length) * 100 : 0;

  return (
    <main className="pb-28">
      <div className="fixed inset-x-0 top-0 z-40 bg-white">
        <div className="max-w-2xl mx-auto border-b border-slate-100 px-4 py-3">
          <div className="grid grid-cols-3 items-center">
            <Link href="/dashboard" className="text-sm font-medium text-slate-600">
              Exit
            </Link>
            <p className="text-center font-serif text-lg text-slate-900">Review</p>
            <p className="text-right text-sm text-slate-500">
              {progressCurrent} of {cards.length}
            </p>
          </div>
          <div className="mt-3 h-1 w-full bg-slate-100">
            <div className="h-full bg-[#2D6A4F]" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      <div className="mx-4 mt-6 pt-20">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setRevealed(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setRevealed(true);
            }
          }}
          className="rounded-3xl border border-slate-100 p-8 text-center cursor-pointer bg-white"
        >
          <h2 className="font-serif text-5xl font-normal text-slate-900">
            {currentCard.words?.word ?? "Word"}
          </h2>
          {!revealed ? (
            <p className="mt-4 text-sm text-slate-500">Tap to reveal</p>
          ) : (
            <>
              <div className="my-6 h-px bg-slate-100" />
              <p className="text-2xl font-semibold text-slate-900">
                {currentCard.words?.translation ?? "No translation available."}
              </p>
              {currentCard.words?.part_of_speech ? (
                <div className="mt-4">
                  <span className="bg-slate-100 text-slate-500 text-xs rounded-full px-3 py-1">
                    {currentCard.words.part_of_speech}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="fixed bottom-20 left-0 right-0 z-30 border-t border-slate-100 bg-white px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="w-full bg-[#2D6A4F] text-white rounded-2xl py-4 font-semibold"
            >
              Reveal answer
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {QUALITY_OPTIONS.map((option) => {
                const className =
                  option.value === 1
                    ? "bg-red-50 text-red-600 border border-red-200 rounded-2xl py-3 text-sm font-medium"
                    : option.value === 2
                      ? "bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl py-3 text-sm font-medium"
                      : option.value === 3
                        ? "bg-green-50 text-green-700 border border-green-200 rounded-2xl py-3 text-sm font-medium"
                        : "bg-[#2D6A4F] text-white rounded-2xl py-3 text-sm font-medium";

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => void submitQuality(option.value)}
                    className={className}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav activeTab="review" hasLearningLanguage={hasLearningLanguage} />
    </main>
  );
}
