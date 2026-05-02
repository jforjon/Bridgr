"use client";

import { CEFR_LEVELS, type Proficiency } from "@/types";

interface ProficiencyPickerProps {
  value: Proficiency;
  onChange: (value: Proficiency) => void;
}

export function ProficiencyPicker({ value, onChange }: ProficiencyPickerProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {CEFR_LEVELS.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`min-w-[2.25rem] rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              selected
                ? "border-primary bg-primary-600 text-white"
                : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
