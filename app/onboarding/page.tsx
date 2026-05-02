"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { LanguageOption, Proficiency } from "@/types";

const KNOWN_LANGUAGES_RAW: LanguageOption[] = [
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

const KNOWN_LANGUAGES = [...KNOWN_LANGUAGES_RAW].sort((a, b) => a.name.localeCompare(b.name));

const KNOWN_CODES: Set<string> = new Set(KNOWN_LANGUAGES.map((l) => l.code));

const EXTRA_SEARCH_LANGUAGES: LanguageOption[] = [
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

const SEARCHABLE_LANGUAGES: LanguageOption[] = (() => {
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

const PROFICIENCY_PILL_LABELS: { level: Proficiency; label: string }[] = [
  { level: "A1", label: "A1 · Beginner" },
  { level: "A2", label: "A2 · Elementary" },
  { level: "B1", label: "B1 · Intermediate" },
  { level: "B2", label: "B2 · Upper intermediate" },
  { level: "C1", label: "C1 · Advanced" },
  { level: "C2", label: "C2 · Fluent" }
];

const LEVEL_CAPTION: Record<Proficiency, string> = {
  A1: "Beginner — I know a few words",
  A2: "Elementary — I can handle simple conversations",
  B1: "Intermediate — I can get by day to day",
  B2: "Upper intermediate — I'm fairly comfortable",
  C1: "Advanced — I speak it well",
  C2: "Fluent — I speak it like a native"
};

type SelectedKnownLanguage = {
  code: string;
  proficiency: Proficiency;
  referenceOnly: boolean;
};

function resolveLanguageName(code: string): string {
  return SEARCHABLE_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

function LanguageLeadingVisual({ language }: { language: LanguageOption }) {
  if (language.code === "ca") {
    return (
      <span
        className="rounded bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-white"
        aria-hidden
      >
        CA
      </span>
    );
  }
  return (
    <span className="text-2xl leading-none" aria-hidden>
      {language.flag}
    </span>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loadingSetup, setLoadingSetup] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [selectedKnownLanguages, setSelectedKnownLanguages] = useState<SelectedKnownLanguage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);

  useEffect(() => {
    const checkExistingSetup = async () => {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { data: knownRows, error: knownError } = await supabase
        .from("known_languages")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (knownError) {
        setError(knownError.message);
        setLoadingSetup(false);
        return;
      }

      if ((knownRows ?? []).length > 0) {
        router.push("/dashboard");
        return;
      }

      setLoadingSetup(false);
    };

    void checkExistingSetup();
  }, [router, supabase]);

  const selectedCodes = useMemo(
    () => new Set(selectedKnownLanguages.map((e) => e.code)),
    [selectedKnownLanguages]
  );

  const searchDropdownCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return SEARCHABLE_LANGUAGES.filter(
      (lang) =>
        !selectedCodes.has(lang.code) &&
        (lang.name.toLowerCase().includes(q) || lang.code.toLowerCase().includes(q))
    ).slice(0, 12);
  }, [searchQuery, selectedCodes]);

  const extraSelectedRows = useMemo(() => {
    return selectedKnownLanguages
      .filter((e) => !KNOWN_CODES.has(e.code))
      .map((e) => SEARCHABLE_LANGUAGES.find((l) => l.code === e.code))
      .filter((l): l is LanguageOption => Boolean(l))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedKnownLanguages]);

  const selectedKnownCount = selectedKnownLanguages.length;
  const continueDisabled = saving || selectedKnownCount === 0;

  const isKnownSelected = (code: string) => selectedCodes.has(code);

  const getEntry = (code: string) => selectedKnownLanguages.find((e) => e.code === code);

  const getKnownProficiency = (code: string) => getEntry(code)?.proficiency;

  const toggleLanguage = (code: string) => {
    if (isKnownSelected(code)) {
      setSelectedKnownLanguages((current) => current.filter((entry) => entry.code !== code));
      return;
    }
    const referenceOnly = !KNOWN_CODES.has(code);
    setSelectedKnownLanguages((current) => [
      ...current,
      { code, proficiency: "B1", referenceOnly }
    ]);
  };

  const setKnownProficiency = (code: string, proficiency: Proficiency) => {
    setSelectedKnownLanguages((current) =>
      current.map((entry) => (entry.code === code ? { ...entry, proficiency } : entry))
    );
  };

  const addLanguageFromSearch = (lang: LanguageOption) => {
    if (selectedCodes.has(lang.code)) return;
    const referenceOnly = !KNOWN_CODES.has(lang.code);
    setSelectedKnownLanguages((current) => [
      ...current,
      { code: lang.code, proficiency: "B1", referenceOnly }
    ]);
    setSearchQuery("");
    setSearchMenuOpen(false);
  };

  const handleContinue = async () => {
    setError("");
    if (selectedKnownCount === 0) {
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError ?? new Error("User not authenticated.");
      }

      const { error: deleteKnownError } = await supabase
        .from("known_languages")
        .delete()
        .eq("user_id", user.id);
      if (deleteKnownError) {
        console.error("[onboarding] known_languages delete failed:", deleteKnownError);
        setError(deleteKnownError.message);
        return;
      }

      const knownRows = selectedKnownLanguages.map((entry) => ({
        user_id: user.id,
        language_code: entry.code,
        language_name: resolveLanguageName(entry.code),
        proficiency: entry.proficiency,
        is_reference_only: entry.referenceOnly
      }));

      console.log("[onboarding] known_languages insert payload:", knownRows);

      const { error: insertError } = await supabase.from("known_languages").insert(knownRows);

      if (insertError) {
        console.error("[onboarding] known_languages insert failed:", insertError);
        setError(insertError.message);
        return;
      }

      router.push("/dashboard");
    } catch (submitError) {
      console.error("[onboarding] handleContinue error:", submitError);
      const message =
        submitError !== null &&
        typeof submitError === "object" &&
        "message" in submitError &&
        typeof (submitError as { message: unknown }).message === "string"
          ? (submitError as { message: string }).message
          : submitError instanceof Error
            ? submitError.message
            : String(submitError);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  function renderLanguageRow(language: LanguageOption) {
    const selected = isKnownSelected(language.code);
    const proficiency = getKnownProficiency(language.code) ?? "B1";

    return (
      <div
        key={language.code}
        className={`w-full rounded-2xl border transition-all ${
          selected ? "border-primary bg-[#E8F5EE]" : "border-border bg-card"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleLanguage(language.code)}
          className="flex w-full items-center px-5 py-4"
        >
          <LanguageLeadingVisual language={language} />
          <span className="ml-4 text-base font-medium text-foreground">{language.name}</span>
          <div className="ml-auto flex shrink-0 items-center justify-center">
            <div
              className={
                selected
                  ? "flex h-5 w-5 items-center justify-center rounded-sm border-2 border-[#2D6A4F] bg-[#2D6A4F]"
                  : "h-5 w-5 rounded-sm border-2 border-slate-300 bg-white"
              }
              aria-hidden
            >
              {selected ? (
                <span className="text-[11px] font-semibold leading-none text-white">✓</span>
              ) : null}
            </div>
          </div>
        </button>

        {selected ? (
          <div className="px-5 pb-4">
            <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PROFICIENCY_PILL_LABELS.map(({ level, label }) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setKnownProficiency(language.code, level)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium ${
                    proficiency === level
                      ? "border-[#2D6A4F] bg-[#2D6A4F] text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1 ml-1 text-xs italic text-slate-500">{LEVEL_CAPTION[proficiency]}</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (loadingSetup) {
    return (
      <main className="p-6 text-sm text-slate-600">Checking your language setup...</main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-6 pt-8">
        <span className="font-serif text-2xl font-normal text-[#2D6A4F]">Bridgr</span>
        <span className="text-sm text-muted-foreground">1 of 1</span>
      </div>

      <div className="mt-8 px-6">
        <h1 className="text-balance font-serif text-3xl font-normal text-foreground">
          What do you already speak?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ll use these to build smarter hints. You can choose a language to learn from the
          dashboard next.
        </p>
      </div>

      <div className="relative z-20 mt-6 px-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search more languages…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchMenuOpen(true);
            }}
            onFocus={() => setSearchMenuOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setSearchMenuOpen(false), 180);
            }}
            className="h-12 w-full rounded-xl border border-input bg-card px-4 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {searchMenuOpen && searchDropdownCandidates.length > 0 ? (
            <ul
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
              role="listbox"
            >
              <div className="max-h-48 overflow-y-auto">
                {searchDropdownCandidates.map((lang) => (
                  <li key={lang.code}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-3 bg-white px-4 py-3 text-left text-sm hover:bg-slate-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addLanguageFromSearch(lang)}
                    >
                      <LanguageLeadingVisual language={lang} />
                      <span className="font-medium text-foreground">{lang.name}</span>
                      <span className="ml-auto text-xs text-slate-500">{lang.code}</span>
                    </button>
                  </li>
                ))}
              </div>
            </ul>
          ) : null}
        </div>
      </div>

      <div className="relative z-0 mt-6 space-y-3 px-6 pb-36">
        {KNOWN_LANGUAGES.map((language) => renderLanguageRow(language))}
        {extraSelectedRows.map((language) => renderLanguageRow(language))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white px-6 py-4">
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        <Button
          type="button"
          onClick={() => void handleContinue()}
          disabled={continueDisabled}
          className="h-auto min-h-0 w-full rounded-2xl border-0 bg-[#2D6A4F] py-4 text-base font-semibold text-white hover:bg-[#245c42] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
