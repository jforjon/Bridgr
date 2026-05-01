"use client";

import type { Proficiency } from "@/types";

interface ProficiencyPickerProps {
  value: Proficiency;
  onChange: (value: Proficiency) => void;
}

const options: Proficiency[] = ["basic", "conversational", "fluent"];

export function ProficiencyPicker({ value, onChange }: ProficiencyPickerProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
              selected
                ? "bg-primary-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
