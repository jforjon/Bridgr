"use client";

import type { LanguageOption } from "@/types";

interface LanguageCardProps {
  language: LanguageOption;
  selected: boolean;
  onClick: () => void;
}

export function LanguageCard({ language, selected, onClick }: LanguageCardProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`flex w-full items-center justify-between rounded-xl p-3 text-left transition ${
        selected
          ? "bg-[var(--card-2)] ring-2 ring-[var(--accent)]"
          : "bg-[var(--card)] hover:bg-[var(--card-2)]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{language.flag}</span>
        <span className="text-sm font-medium text-[var(--text-primary)]">{language.name}</span>
      </div>
      {selected ? (
        <span className="text-xs font-extrabold text-[var(--accent)]">Selected</span>
      ) : null}
    </button>
  );
}
