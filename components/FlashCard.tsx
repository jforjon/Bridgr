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
      className={`rounded-xl bg-[var(--surface-1)] p-6 ${revealed ? "" : "cursor-pointer"}`}
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[var(--text-1)]">{word.word}</h2>
        {word.romanization ? (
          <p className="mt-2 text-base italic text-[var(--text-2)]">{word.romanization}</p>
        ) : null}
      </div>

      {revealed ? (
        <div className="mt-6 space-y-4 border-t border-[var(--border)] pt-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-label text-[var(--text-2)]">
              Translation
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--accent-text)]">{word.translation}</p>
          </div>

          {word.part_of_speech ? (
            <p className="text-sm text-[var(--text-2)]">Part of speech: {word.part_of_speech}</p>
          ) : null}

          <div className="rounded-lg bg-[var(--surface-2)] p-4">
            {hintLoading ? (
              <p className="text-sm text-[var(--text-2)]">Loading hint...</p>
            ) : hint ? (
              <>
                <p className="text-xs font-bold uppercase tracking-label text-[var(--text-2)]">
                  Hint
                </p>
                <p className="mt-1 text-sm text-[var(--text-1)]">{hint.hint_text}</p>
              </>
            ) : (
              <p className="text-sm text-[var(--text-2)]">No hint available for this word.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-center text-sm font-semibold text-[var(--accent-text)]">Tap to reveal</p>
      )}
    </section>
  );
}
