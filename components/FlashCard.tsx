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
      className={`rounded-xl bg-[var(--card)] p-6 ${revealed ? "" : "cursor-pointer"}`}
    >
      <div className="text-center">
        <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">{word.word}</h2>
        {word.romanization ? (
          <p className="mt-2 text-base italic text-[var(--text-secondary)]">{word.romanization}</p>
        ) : null}
      </div>

      {revealed ? (
        <div className="mt-6 space-y-4 border-t border-[var(--border)] pt-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-label text-[var(--text-secondary)]">
              Translation
            </p>
            <p className="mt-1 text-xl font-extrabold text-[var(--accent)]">{word.translation}</p>
          </div>

          {word.part_of_speech ? (
            <p className="text-sm text-[var(--text-secondary)]">Part of speech: {word.part_of_speech}</p>
          ) : null}

          <div className="rounded-lg bg-[var(--card-2)] p-4">
            {hintLoading ? (
              <p className="text-sm text-[var(--text-secondary)]">Loading hint...</p>
            ) : hint ? (
              <>
                <p className="text-xs font-bold uppercase tracking-label text-[var(--text-secondary)]">
                  Hint
                </p>
                <p className="mt-1 text-sm text-[var(--text-primary)]">{hint.hint_text}</p>
              </>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">No hint available for this word.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-center text-sm font-extrabold text-[var(--accent)]">Tap to reveal</p>
      )}
    </section>
  );
}
