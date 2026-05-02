"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/client";
import type { Hint, KnownLanguage, LearningLanguage, Word } from "@/types";

export default function LearnPage() {
  const supabase = createClient();
  const [words, setWords] = useState<Word[]>([]);
  const [knownLanguages, setKnownLanguages] = useState<string[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>("es");
  const [hasLearningLanguage, setHasLearningLanguage] = useState(true);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        setError("Please log in first.");
        return;
      }

      const [{ data: knownRows }, { data: learningRows }] = await Promise.all([
        supabase.from("known_languages").select("*").eq("user_id", user.id),
        supabase
          .from("learning_languages")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
      ]);

      const knownTyped = (knownRows ?? []) as KnownLanguage[];
      const learningTyped = (learningRows ?? []) as LearningLanguage[];
      setHasLearningLanguage(learningTyped.length > 0);
      const target = learningTyped[0] ?? null;
      const unique = knownTyped.filter(
        (l, i, arr) => arr.findIndex((x) => x.language_code === l.language_code) === i
      );
      const known = unique.map((row) => row.language_code);
      const effectiveTargetLanguage = target?.language_code ?? "it";

      if (target) {
        setTargetLanguage(target.language_code);
      } else {
        setTargetLanguage("it");
      }
      setKnownLanguages(known);

      const { data: wordRows, error: wordError } = await supabase
        .from("words")
        .select("*")
        .eq("language_code", effectiveTargetLanguage)
        .limit(10);

      setLoading(false);
      if (wordError) {
        setError(wordError.message);
        return;
      }

      setWords((wordRows ?? []) as Word[]);
    };

    void load();
  }, [supabase]);

  const currentWord = useMemo(() => words[index] ?? null, [words, index]);
  const sessionComplete = words.length > 0 && index >= words.length;
  const progressPct = words.length > 0 ? ((index + 1) / words.length) * 100 : 0;

  const reveal = async () => {
    if (!currentWord) return;
    setRevealed(true);
    setHintLoading(true);

    const response = await fetch("/api/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wordId: currentWord.id,
        word: currentWord.word,
        targetLanguage,
        knownLanguages
      })
    });

    setHintLoading(false);
    if (response.status === 204) {
      setHint(null);
      return;
    }
    if (response.ok) {
      const payload = (await response.json()) as { hint: Hint };
      setHint(payload.hint);
    }
  };

  const goNext = () => {
    setHint(null);
    setRevealed(false);
    setIndex((current) => current + 1);
  };

  const goPrev = () => {
    setHint(null);
    setRevealed(false);
    setIndex((current) => Math.max(0, current - 1));
  };

  if (loading) {
    return (
      <>
        <main className="p-6 pb-28 text-sm text-slate-600">Loading words...</main>
        <BottomNav activeTab="learn" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="p-6 pb-28 text-sm text-red-600">{error}</main>
        <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
      </>
    );
  }

  if (sessionComplete || !currentWord) {
    return (
      <>
        <main className="p-6 pb-28">
          <h1 className="mt-8 text-2xl font-bold text-primary">Session complete</h1>
          <p className="mt-2 text-sm text-slate-600">
            Nice work. You reviewed all words in this learning session.
          </p>
        </main>
        <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
      </>
    );
  }

  return (
    <main className="pb-28">
      <div className="fixed inset-x-0 top-0 z-40 bg-white">
        <div className="max-w-2xl mx-auto border-b border-slate-100 px-4 py-3">
          <div className="grid grid-cols-3 items-center">
            <Link href="/dashboard" className="text-sm font-medium text-slate-600">
              Exit
            </Link>
            <p className="text-center text-sm text-slate-600">
              Word {index + 1} of {words.length}
            </p>
            <div />
          </div>
          <div className="mt-3 h-1 w-full bg-slate-100">
            <div className="h-full bg-[#2D6A4F]" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      <div className="pt-24">
        <div
          role={revealed ? undefined : "button"}
          tabIndex={revealed ? undefined : 0}
          onClick={revealed ? undefined : () => void reveal()}
          onKeyDown={(event) => {
            if (!revealed && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              void reveal();
            }
          }}
          className={`rounded-3xl border border-slate-100 p-8 text-center bg-white ${
            revealed ? "" : "cursor-pointer"
          }`}
        >
          <h1 className="font-serif text-5xl font-normal text-slate-900">{currentWord.word}</h1>

          <div className="my-6 h-px bg-slate-100" />

          {revealed ? (
            <>
              <p className="text-xs uppercase tracking-widest text-slate-400">Translation</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{currentWord.translation}</p>
              {currentWord.part_of_speech ? (
                <div className="mt-4">
                  <span className="bg-slate-100 text-slate-500 text-xs rounded-full px-3 py-1">
                    {currentWord.part_of_speech}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">Tap to reveal</p>
          )}
        </div>

        {revealed ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-amber-600 text-xs uppercase tracking-widest">Hint</p>
            {hintLoading ? (
              <div className="mt-2 space-y-2">
                <div className="h-3 w-4/5 animate-pulse rounded bg-amber-200" />
                <div className="h-3 w-full animate-pulse rounded bg-amber-200" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-amber-200" />
              </div>
            ) : hint ? (
              <p className="mt-2 text-sm leading-relaxed text-amber-800">{hint.hint_text}</p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No hint available</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="fixed bottom-20 left-0 right-0 z-30 border-t border-slate-100 bg-white px-4 py-4">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            className="border border-slate-200 text-slate-600 rounded-2xl py-3 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={goNext}
            className="bg-[#2D6A4F] text-white rounded-2xl py-3 font-semibold"
          >
            Next word
          </button>
        </div>
      </div>

      <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
    </main>
  );
}
