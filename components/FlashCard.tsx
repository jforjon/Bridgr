"use client";

import type { Hint, Word } from "@/types";

interface FlashCardProps {
  word: Word;
  hint: Hint | null;
  hintLoading: boolean;
  onReveal: () => void;
  revealed: boolean;
}

export default function FlashCard({
  word,
  hint,
  hintLoading,
  onReveal,
  revealed
}: FlashCardProps) {
  return (
    <section
      onClick={revealed ? undefined : onReveal}
      className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${
        revealed ? "" : "cursor-pointer"
      }`}
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900">{word.word}</h2>
        {word.romanization ? (
          <p className="mt-2 text-base italic text-slate-500">{word.romanization}</p>
        ) : null}
      </div>

      {revealed ? (
        <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Translation
            </p>
            <p className="mt-1 text-xl font-semibold text-primary">{word.translation}</p>
          </div>

          {word.part_of_speech ? (
            <p className="text-sm text-slate-600">Part of speech: {word.part_of_speech}</p>
          ) : null}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            {hintLoading ? (
              <p className="text-sm text-amber-800">Loading hint...</p>
            ) : hint ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Hint
                </p>
                <p className="mt-1 text-sm text-amber-900">{hint.hint_text}</p>
              </>
            ) : (
              <p className="text-sm text-amber-800">No hint available for this word.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-center text-sm font-semibold text-primary">
          Tap to reveal
        </p>
      )}
    </section>
  );
}
