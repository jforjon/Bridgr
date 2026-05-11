"use client";

import { IconCheck } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { LanguageOption, Proficiency } from "@/types";
import {
  KNOWN_CODES,
  KNOWN_LANGUAGES,
  LEVEL_CAPTION,
  PROFICIENCY_PILL_LABELS,
  SEARCHABLE_LANGUAGES,
  getLanguageVisual,
  resolveLanguageName
} from "../shared";

type SelectedKnownLanguage = {
  code: string;
  proficiency: Proficiency;
  referenceOnly: boolean;
};

const searchInputClass =
  "h-12 w-full rounded-xl border border-teal-400/30 bg-teal-850 px-4 text-white placeholder:text-teal-300 outline-none focus:border-lime-300";

const bottomBar =
  "fixed bottom-0 left-0 right-0 z-50 border-t border-teal-700/50 bg-teal-900 px-6 py-4";

export default function OnboardingStepThreePage() {
  const router = useRouter();
  const supabase = createClient();

  const [selectedKnownLanguages, setSelectedKnownLanguages] = useState<SelectedKnownLanguage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedCodes = useMemo(
    () => new Set(selectedKnownLanguages.map((entry) => entry.code)),
    [selectedKnownLanguages]
  );

  const searchDropdownCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return SEARCHABLE_LANGUAGES.filter(
      (language) =>
        !selectedCodes.has(language.code) &&
        (language.name.toLowerCase().includes(query) || language.code.toLowerCase().includes(query))
    ).slice(0, 12);
  }, [searchQuery, selectedCodes]);

  const extraSelectedRows = useMemo(() => {
    return selectedKnownLanguages
      .filter((entry) => !KNOWN_CODES.has(entry.code))
      .map((entry) => SEARCHABLE_LANGUAGES.find((language) => language.code === entry.code))
      .filter((language): language is LanguageOption => Boolean(language))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedKnownLanguages]);

  const getKnownProficiency = (code: string) =>
    selectedKnownLanguages.find((entry) => entry.code === code)?.proficiency ?? "B1";

  const isKnownSelected = (code: string) => selectedCodes.has(code);

  const toggleLanguage = (code: string) => {
    if (isKnownSelected(code)) {
      setSelectedKnownLanguages((current) => current.filter((entry) => entry.code !== code));
      return;
    }

    setSelectedKnownLanguages((current) => [
      ...current,
      { code, proficiency: "B1", referenceOnly: !KNOWN_CODES.has(code) }
    ]);
  };

  const setKnownProficiency = (code: string, proficiency: Proficiency) => {
    setSelectedKnownLanguages((current) =>
      current.map((entry) => (entry.code === code ? { ...entry, proficiency } : entry))
    );
  };

  const addLanguageFromSearch = (language: LanguageOption) => {
    if (selectedCodes.has(language.code)) return;
    setSelectedKnownLanguages((current) => [
      ...current,
      { code: language.code, proficiency: "B1", referenceOnly: !KNOWN_CODES.has(language.code) }
    ]);
    setSearchQuery("");
    setSearchMenuOpen(false);
  };

  const saveKnownLanguages = async () => {
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
      throw deleteKnownError;
    }

    if (selectedKnownLanguages.length === 0) {
      return;
    }

    const knownRows = selectedKnownLanguages.map((entry) => ({
      user_id: user.id,
      language_code: entry.code,
      language_name: resolveLanguageName(entry.code),
      proficiency: entry.proficiency,
      is_reference_only: entry.referenceOnly
    }));

    const { error: insertError } = await supabase.from("known_languages").insert(knownRows);

    if (insertError) {
      throw insertError;
    }
  };

  const handleContinue = async () => {
    setSaving(true);
    setError("");
    try {
      await saveKnownLanguages();
      router.push("/onboarding/4");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSaving(false);
    }
  };

  const renderLanguageRow = (language: LanguageOption) => {
    const selected = isKnownSelected(language.code);
    const proficiency = getKnownProficiency(language.code);

    return (
      <div
        key={language.code}
        className={`w-full rounded-xl border transition-all ${
          selected ? "border-lime-300 bg-lime-300/10" : "border-teal-400/30 bg-teal-800"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleLanguage(language.code)}
          className="flex w-full items-center px-5 py-4"
        >
          <span className="text-2xl">{getLanguageVisual(language)}</span>
          <span className="ml-4 text-base font-bold text-white">{language.name}</span>
          <div className="ml-auto flex shrink-0 items-center justify-center">
            <div
              className={
                selected
                  ? "flex h-5 w-5 items-center justify-center rounded-sm border-2 border-lime-300 bg-lime-300"
                  : "h-5 w-5 rounded-sm border-2 border-teal-400 bg-teal-850"
              }
              aria-hidden
            >
              {selected ? (
                <IconCheck size={12} className="text-lime-700" stroke={3} aria-hidden />
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
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold ${
                    proficiency === level
                      ? "border-lime-300 bg-lime-300 text-lime-700"
                      : "border-teal-400/30 bg-teal-850 text-teal-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="ml-1 mt-1 text-xs italic text-teal-300">{LEVEL_CAPTION[proficiency]}</p>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-sans text-3xl font-extrabold text-white">
          What other languages do you speak?
        </h1>
        <button
          type="button"
          onClick={() => router.push("/onboarding/4")}
          className="shrink-0 text-sm font-bold text-lime-300"
        >
          Skip
        </button>
      </div>

      <div className="relative z-20 mt-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search more languages..."
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchMenuOpen(true);
            }}
            onFocus={() => setSearchMenuOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchMenuOpen(false), 180)}
            className={searchInputClass}
          />
          {searchMenuOpen && searchDropdownCandidates.length > 0 ? (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-hidden rounded-xl border border-teal-400/30 bg-teal-850 shadow-lg">
              <div className="max-h-48 overflow-y-auto">
                {searchDropdownCandidates.map((language) => (
                  <li key={language.code}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 bg-teal-850 px-4 py-3 text-left text-sm text-white hover:bg-teal-800"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addLanguageFromSearch(language)}
                    >
                      <span className="text-xl">{getLanguageVisual(language)}</span>
                      <span className="font-bold">{language.name}</span>
                      <span className="ml-auto text-xs text-teal-300">{language.code}</span>
                    </button>
                  </li>
                ))}
              </div>
            </ul>
          ) : null}
        </div>
      </div>

      <div className="relative z-0 mt-6 space-y-3">
        {KNOWN_LANGUAGES.map((language) => renderLanguageRow(language))}
        {extraSelectedRows.map((language) => renderLanguageRow(language))}
      </div>

      <div className={bottomBar}>
        <div className="mx-auto w-full max-w-[480px]">
          {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/onboarding/4")}
              disabled={saving}
              className="h-auto min-h-0 rounded-full border border-teal-400/30 bg-transparent py-4 text-base font-extrabold text-teal-200 hover:bg-teal-800"
            >
              Skip
            </Button>
            <Button
              type="button"
              onClick={() => void handleContinue()}
              disabled={saving}
              className="h-auto min-h-0 rounded-full border-0 bg-lime-300 py-4 text-base font-extrabold text-lime-700 hover:bg-lime-300/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
