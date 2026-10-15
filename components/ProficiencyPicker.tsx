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
            className={`min-w-[2.25rem] rounded-pill border px-3 py-1.5 text-xs font-semibold transition ${
              selected
                ? "border-[var(--accent-text)] bg-accent-fill font-semibold text-accent-ink"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-1)]"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
