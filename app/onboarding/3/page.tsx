"use client";

import { IconCheck } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
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
  "field-input";

const bottomBar =
  "px-page fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg)] py-4";

export default function OnboardingStepThreePage() {
  const router = useRouter();
  const supabase = createClient();

  const [selectedKnownLanguages, setSelectedKnownLanguages] = useState<SelectedKnownLanguage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nativeLanguageCode, setNativeLanguageCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadNativeLanguage = async () => {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user || cancelled) {
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("native_language_code")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || cancelled) {
        return;
      }

      const code = profile?.native_language_code?.trim().toLowerCase() ?? null;
      setNativeLanguageCode(code || null);
    };

    void loadNativeLanguage();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const isNativeLanguage = (code: string) =>
    nativeLanguageCode !== null && code.toLowerCase() === nativeLanguageCode;

  const pickerLanguages = useMemo(
    () => KNOWN_LANGUAGES.filter((language) => !isNativeLanguage(language.code)),
    [nativeLanguageCode]
  );

  useEffect(() => {
    if (!nativeLanguageCode) return;
    setSelectedKnownLanguages((current) =>
      current.filter((entry) => entry.code.toLowerCase() !== nativeLanguageCode)
    );
  }, [nativeLanguageCode]);

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
        !isNativeLanguage(language.code) &&
        (language.name.toLowerCase().includes(query) || language.code.toLowerCase().includes(query))
    ).slice(0, 12);
  }, [searchQuery, selectedCodes, nativeLanguageCode]);

  const extraSelectedRows = useMemo(() => {
    return selectedKnownLanguages
      .filter((entry) => !KNOWN_CODES.has(entry.code) && !isNativeLanguage(entry.code))
      .map((entry) => SEARCHABLE_LANGUAGES.find((language) => language.code === entry.code))
      .filter((language): language is LanguageOption => Boolean(language))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedKnownLanguages, nativeLanguageCode]);

  const getKnownProficiency = (code: string) =>
    selectedKnownLanguages.find((entry) => entry.code === code)?.proficiency ?? "B1";

  const isKnownSelected = (code: string) => selectedCodes.has(code);

  const toggleLanguage = (code: string) => {
    if (isNativeLanguage(code)) return;

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
    if (selectedCodes.has(language.code) || isNativeLanguage(language.code)) return;
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

    // Replace only the "other languages" the user manages here. The native
    // language (saved in step 2) is a known_languages row too, but it is not
    // shown in this picker — so it must survive this delete, otherwise saving
    // with nothing selected would wipe the row the /learn gate depends on.
    let deleteKnown = supabase.from("known_languages").delete().eq("user_id", user.id);
    if (nativeLanguageCode) {
      deleteKnown = deleteKnown.neq("language_code", nativeLanguageCode);
    }
    const { error: deleteKnownError } = await deleteKnown;

    if (deleteKnownError) {
      throw deleteKnownError;
    }

    if (selectedKnownLanguages.length === 0) {
      return;
    }

    const knownRows = selectedKnownLanguages
      .filter((entry) => !isNativeLanguage(entry.code))
      .map((entry) => ({
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
          selected ? "border-[var(--accent-text)] bg-[var(--surface-2)]" : "border-[var(--border)] bg-[var(--surface-1)]"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleLanguage(language.code)}
          className="flex w-full items-center px-5 py-4"
        >
          <span className="text-2xl">{getLanguageVisual(language)}</span>
          <span className="ml-4 text-base font-bold text-[var(--text-1)]">{language.name}</span>
          <div className="ml-auto flex shrink-0 items-center justify-center">
            <div
              className={
                selected
                  ? "flex h-5 w-5 items-center justify-center rounded-sm border-2 border-[var(--accent-text)] bg-accent-fill"
                  : "h-5 w-5 rounded-sm border-2 border-[var(--border)] bg-[var(--surface-2)]"
              }
              aria-hidden
            >
              {selected ? (
                <IconCheck size={12} className="text-accent-ink" stroke={3} aria-hidden />
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
                      ? "border-[var(--accent-text)] bg-accent-fill text-accent-ink"
                      : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="ml-1 mt-1 text-xs italic text-[var(--text-2)]">{LEVEL_CAPTION[proficiency]}</p>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-sans text-3xl font-semibold text-[var(--text-1)]">
          What other languages do you speak?
        </h1>
        <button
          type="button"
          onClick={() => router.push("/onboarding/4")}
          className="shrink-0 text-sm font-bold text-[var(--accent-text)]"
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
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)] shadow-lg">
              <div className="max-h-48 overflow-y-auto">
                {searchDropdownCandidates.map((language) => (
                  <li key={language.code}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 bg-[var(--surface-2)] px-4 py-3 text-left text-sm text-[var(--text-1)] hover:bg-[var(--surface-1)]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addLanguageFromSearch(language)}
                    >
                      <span className="text-xl">{getLanguageVisual(language)}</span>
                      <span className="font-bold">{language.name}</span>
                      <span className="ml-auto text-xs text-[var(--text-2)]">{language.code}</span>
                    </button>
                  </li>
                ))}
              </div>
            </ul>
          ) : null}
        </div>
      </div>

      <div className="relative z-0 mt-6 space-y-3">
        {pickerLanguages.map((language) => renderLanguageRow(language))}
        {extraSelectedRows.map((language) => renderLanguageRow(language))}
      </div>

      <div className={bottomBar}>
        <div className="mx-auto w-full max-w-[480px]">
          {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/onboarding/4")}
              disabled={saving}
              className="flex-1"
            >
              Skip
            </Button>
            <Button
              type="button"
              onClick={() => void handleContinue()}
              disabled={saving}
              className="flex-1"
            >
              {saving ? "Saving..." : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
