"use client";

import { useMemo, useState } from "react";
import CognateNoteLine from "@/components/session/CognateNoteLine";
import { cognateNoteForCard } from "@/lib/session-cognate";
import type { CardOutcome, SentenceCard } from "@/types";

function shuffleOptions(options: string[]): string[] {
  const copy = [...options];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface SessionStage1CardProps {
  sentenceCard: SentenceCard;
  languageName: string;
  onContinue: (outcome: CardOutcome) => Promise<void>;
  continueLoading: boolean;
}

export default function SessionStage1Card({
  sentenceCard,
  languageName,
  onContinue,
  continueLoading
}: SessionStage1CardProps) {
  const correctAnswer = sentenceCard.correct_answer.trim();
  const [selected, setSelected] = useState<string | null>(null);

  const options = useMemo(
    () =>
      shuffleOptions([
        correctAnswer,
        ...sentenceCard.distractors.map((d) => d.trim()).filter(Boolean)
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shuffle once per card
    [sentenceCard.id]
  );

  const cognateNote = useMemo(() => cognateNoteForCard(sentenceCard), [sentenceCard]);
  const isCorrect = selected === correctAnswer;
  const hasSelected = selected != null;

  function optionClass(option: string): string {
    const base =
      "w-full cursor-pointer rounded-md border py-4 px-5 text-left text-base font-medium transition-colors duration-150";
    if (!hasSelected) {
      return `${base} border-line bg-card text-ink hover:bg-card-2`;
    }
    if (option === correctAnswer) {
      return `${base} border-success/50 bg-success-soft text-ink`;
    }
    if (option === selected) {
      return `${base} border-danger/40 bg-danger-soft text-danger`;
    }
    return `${base} border-line bg-card text-ink opacity-50`;
  }

  return (
    <>
      <div className="px-page mx-auto max-w-lg pb-36 pt-10">
        <p className="label-caps text-center">How do you say this in {languageName}?</p>
        <p className="mb-8 mt-6 text-center font-serif text-4xl leading-tight text-ink">
          {sentenceCard.target_item_en.trim()}
        </p>

        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={hasSelected}
              className={optionClass(option)}
              onClick={() => setSelected(option)}
            >
              {option}
            </button>
          ))}
        </div>

        {hasSelected && cognateNote ? <CognateNoteLine note={cognateNote} /> : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-app p-5 pb-8">
        <button
          type="button"
          disabled={!hasSelected || continueLoading}
          className="btn-primary w-full disabled:opacity-30"
          onClick={() => void onContinue(isCorrect ? "solid" : "miss")}
        >
          {continueLoading ? "Saving…" : "Continue"}
        </button>
      </div>

    </>
  );
}
