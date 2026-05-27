"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { SEARCHABLE_LANGUAGES, getLanguageVisual } from "../shared";

const inputClass =
  "h-12 w-full rounded-pill border-none bg-[var(--card-2)] px-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:outline-none";

const bottomBar =
  "fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg)] px-6 py-4";

export default function OnboardingStepTwoPage() {
  const router = useRouter();
  const supabase = createClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredLanguages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return SEARCHABLE_LANGUAGES;
    return SEARCHABLE_LANGUAGES.filter(
      (language) =>
        language.name.toLowerCase().includes(query) || language.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleContinue = async () => {
    if (!selectedCode) return;
    const selectedLanguage = SEARCHABLE_LANGUAGES.find((lang) => lang.code === selectedCode);
    if (!selectedLanguage) return;

    setSaving(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError ?? new Error("User not authenticated.");
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          native_language_code: selectedLanguage.code,
          native_language_name: selectedLanguage.name
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      router.push("/onboarding/3");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1 className="font-sans text-3xl font-extrabold text-[var(--text-primary)]">What is your native language?</h1>

      <div className="mt-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search languages..."
          className={inputClass}
        />
      </div>

      <div className="mt-4 space-y-2">
        {filteredLanguages.map((language) => {
          const selected = selectedCode === language.code;
          return (
            <button
              key={language.code}
              type="button"
              onClick={() => setSelectedCode(language.code)}
              className={`flex w-full items-center rounded-xl border px-4 py-4 text-left ${
                selected ? "border-[var(--accent)] bg-[var(--card-2)]" : "border-[var(--border)] bg-[var(--card)]"
              }`}
            >
              <span className="text-2xl">{getLanguageVisual(language)}</span>
              <span className="ml-3 text-base font-bold text-[var(--text-primary)]">{language.name}</span>
              <span
                className={`ml-auto h-5 w-5 rounded-full border-2 ${
                  selected ? "border-[var(--accent)] bg-[#BFFF00]" : "border-[var(--border)] bg-[var(--card-2)]"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className={bottomBar}>
        <div className="mx-auto w-full max-w-[480px]">
          {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!selectedCode || saving}
            className="h-auto min-h-0 w-full rounded-pill bg-[#BFFF00] py-4 text-base font-extrabold text-[#2A3800] hover:bg-[#A8E000] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </>
  );
}
