"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { SEARCHABLE_LANGUAGES, getLanguageVisual } from "../shared";

const inputClass =
  "h-12 w-full rounded-xl border border-teal-400/30 bg-teal-850 px-4 text-white placeholder:text-teal-300 outline-none focus:border-lime-300";

const bottomBar =
  "fixed bottom-0 left-0 right-0 z-50 border-t border-teal-700/50 bg-teal-900 px-6 py-4";

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
      <h1 className="font-sans text-3xl font-extrabold text-white">What is your native language?</h1>

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
                selected ? "border-lime-300 bg-lime-300/10" : "border-teal-400/30 bg-teal-800"
              }`}
            >
              <span className="text-2xl">{getLanguageVisual(language)}</span>
              <span className="ml-3 text-base font-bold text-white">{language.name}</span>
              <span
                className={`ml-auto h-5 w-5 rounded-full border-2 ${
                  selected ? "border-lime-300 bg-lime-300" : "border-teal-400 bg-teal-850"
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
            className="h-auto min-h-0 w-full rounded-full border-0 bg-lime-300 py-4 text-base font-extrabold text-lime-700 hover:bg-lime-300/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </>
  );
}
