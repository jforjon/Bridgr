"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { SEARCHABLE_LANGUAGES, getLanguageVisual } from "../shared";

const inputClass =
  "field-input";

const bottomBar =
  "px-page fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg)] py-4";

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

      // The native language is also a known language (the primary bridge source
      // for cross-linguistic hints) and, crucially, the app treats "has ≥1
      // known_languages row" as onboarding-complete. Persisting it here means a
      // learner who skips step 3 ("other languages") still lands on /learn
      // instead of being bounced back into onboarding.
      const { error: knownError } = await supabase.from("known_languages").upsert(
        {
          user_id: user.id,
          language_code: selectedLanguage.code,
          language_name: selectedLanguage.name,
          proficiency: "C2",
          is_reference_only: false
        },
        { onConflict: "user_id,language_code" }
      );

      if (knownError) {
        throw knownError;
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
      <h1 className="font-sans text-3xl font-semibold text-[var(--text-1)]">What is your native language?</h1>

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
                selected ? "border-[var(--accent-text)] bg-[var(--surface-2)]" : "border-[var(--border)] bg-[var(--surface-1)]"
              }`}
            >
              <span className="text-2xl">{getLanguageVisual(language)}</span>
              <span className="ml-3 text-base font-bold text-[var(--text-1)]">{language.name}</span>
              <span
                className={`ml-auto h-5 w-5 rounded-full border-2 ${
                  selected ? "border-[var(--accent-text)] bg-accent-fill" : "border-[var(--border)] bg-[var(--surface-2)]"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className={bottomBar}>
        <div className="mx-auto w-full max-w-[480px]">
          {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!selectedCode || saving}
            fullWidth
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </>
  );
}
