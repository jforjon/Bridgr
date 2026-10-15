"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRegisterOnboardingBack } from "../OnboardingBackContext";
import {
  LEARNING_LANGUAGE_OPTIONS,
  ONBOARDING_LANGUAGE_STORAGE_KEY,
  type OnboardingStepFourSubScreen,
  getLanguageVisual
} from "../shared";

const bottomBar =
  "px-page fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg)] py-4";

export default function OnboardingStepFourPage() {
  const router = useRouter();
  const supabase = createClient();

  const [subScreen, setSubScreen] = useState<OnboardingStepFourSubScreen>("language");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string | null>(null);
  const [existingLearningCodes, setExistingLearningCodes] = useState<string[]>([]);

  const returnToLanguageSelection = useCallback(() => {
    setSubScreen("language");
    setError("");
  }, []);

  useRegisterOnboardingBack(subScreen === "goal" ? returnToLanguageSelection : null);

  useEffect(() => {
    const loadUserLanguages = async () => {
      try {
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw userError ?? new Error("User not authenticated.");
        }

        const { data, error: learningError } = await supabase
          .from("learning_languages")
          .select("language_code")
          .eq("user_id", user.id);

        if (learningError) {
          throw learningError;
        }

        const codes = (data ?? []).map((row) => row.language_code as string);
        setExistingLearningCodes(codes);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setLoading(false);
      }
    };

    void loadUserLanguages();
  }, [supabase]);

  const availableLanguages = useMemo(
    () =>
      LEARNING_LANGUAGE_OPTIONS.filter((language) => !existingLearningCodes.includes(language.code)),
    [existingLearningCodes]
  );

  const handleContinue = async () => {
    if (!selectedLanguageCode) return;
    setSaving(true);
    setError("");

    try {
      localStorage.setItem(ONBOARDING_LANGUAGE_STORAGE_KEY, selectedLanguageCode);
      router.push(`/onboarding/5?language=${selectedLanguageCode}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
      setSaving(false);
    }
  };

  return (
    <>
      <h1 className="font-sans text-3xl font-semibold text-[var(--text-1)]">What would you like to learn?</h1>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-[var(--text-2)]">Loading languages...</p>
        ) : availableLanguages.length === 0 ? (
          <p className="rounded-xl bg-[var(--surface-1)] p-4 text-sm text-[var(--text-2)]">
            You already added all available languages.
          </p>
        ) : (
          availableLanguages.map((language) => {
            const selected = selectedLanguageCode === language.code;
            return (
              <button
                key={language.code}
                type="button"
                onClick={() => setSelectedLanguageCode(language.code)}
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
          })
        )}
      </div>

      <div className={bottomBar}>
        <div className="mx-auto w-full max-w-[480px]">
          {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={loading || !selectedLanguageCode || saving}
            fullWidth
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </>
  );
}
