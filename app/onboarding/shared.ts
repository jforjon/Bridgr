"use client";

import type { LanguageOption, Proficiency } from "@/types";

export const ONBOARDING_TOTAL_STEPS = 6;
export const ONBOARDING_LANGUAGE_STORAGE_KEY = "onboarding_language_code";

export const KNOWN_LANGUAGES_RAW: LanguageOption[] = [
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "bn", name: "Bengali", flag: "🇧🇩" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "pt", name: "Portuguese", flag: "🇧🇷" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "ur", name: "Urdu", flag: "🇵🇰" }
];

export const KNOWN_LANGUAGES = [...KNOWN_LANGUAGES_RAW].sort((a, b) => a.name.localeCompare(b.name));

export const KNOWN_CODES: Set<string> = new Set(KNOWN_LANGUAGES.map((l) => l.code));

export const EXTRA_SEARCH_LANGUAGES: LanguageOption[] = [
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ms", name: "Malay", flag: "🇲🇾" },
  { code: "fa", name: "Persian", flag: "🇮🇷" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "sw", name: "Swahili", flag: "🇹🇿" },
  { code: "ta", name: "Tamil", flag: "🇱🇰" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "ca", name: "Catalan", flag: "" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "el", name: "Greek", flag: "🇬🇷" },
  { code: "he", name: "Hebrew", flag: "🇮🇱" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
  { code: "da", name: "Danish", flag: "🇩🇰" },
  { code: "no", name: "Norwegian", flag: "🇳🇴" }
];

export const SEARCHABLE_LANGUAGES: LanguageOption[] = (() => {
  const byCode = new Map<string, LanguageOption>();
  for (const lang of KNOWN_LANGUAGES_RAW) {
    byCode.set(lang.code, lang);
  }
  for (const lang of EXTRA_SEARCH_LANGUAGES) {
    if (!byCode.has(lang.code)) {
      byCode.set(lang.code, lang);
    }
  }
  return Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name));
})();

export const PROFICIENCY_PILL_LABELS: { level: Proficiency; label: string }[] = [
  { level: "A1", label: "A1 · Beginner" },
  { level: "A2", label: "A2 · Elementary" },
  { level: "B1", label: "B1 · Intermediate" },
  { level: "B2", label: "B2 · Upper intermediate" },
  { level: "C1", label: "C1 · Advanced" },
  { level: "C2", label: "C2 · Fluent" }
];

export const LEVEL_CAPTION: Record<Proficiency, string> = {
  A1: "Beginner — I know a few words",
  A2: "Elementary — I can handle simple conversations",
  B1: "Intermediate — I can get by day to day",
  B2: "Upper intermediate — I'm fairly comfortable",
  C1: "Advanced — I speak it well",
  C2: "Fluent — I speak it like a native"
};

export const LEARNING_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "ca", name: "Catalan", flag: "" },
  { code: "en", name: "English", flag: "🇬🇧" }
];

export function resolveLanguageName(code: string): string {
  return SEARCHABLE_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

export function getLanguageVisual(language: LanguageOption): string {
  if (language.code === "ca") return "CA";
  return language.flag;
}
