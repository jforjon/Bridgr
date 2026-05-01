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
      className={`flex w-full items-center justify-between rounded border p-3 text-left transition ${
        selected
          ? "border-primary-600 bg-primary-600/5"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{language.flag}</span>
        <span className="text-sm font-medium text-slate-800">{language.name}</span>
      </div>
      {selected ? <span className="text-xs font-semibold text-primary">Selected</span> : null}
    </button>
  );
}
