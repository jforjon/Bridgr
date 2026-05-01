"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { SUPPORTED_LANGUAGES } from "@/types";
import type { Proficiency } from "@/types";

type Step = 1 | 2;
type SelectedKnownLanguage = {
  code: string;
  proficiency: Proficiency;
};

const proficiencyLevels: { value: Proficiency; label: string }[] = [
  { value: "basic", label: "Basic" },
  { value: "conversational", label: "Conversational" },
  { value: "fluent", label: "Fluent" }
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>(1);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState<string>("");
  const [selectedKnownLanguages, setSelectedKnownLanguages] = useState<SelectedKnownLanguage[]>([]);

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

      const { data: existingRows, error: existingRowsError } = await supabase
        .from("user_languages")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (existingRowsError) {
        setError(existingRowsError.message);
        setLoadingSetup(false);
        return;
      }

      if ((existingRows ?? []).length > 0) {
        router.push("/dashboard");
        return;
      }

      setLoadingSetup(false);
    };

    void checkExistingSetup();
  }, [router, supabase]);

  const step1Languages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter((language) =>
      language.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const step2Languages = useMemo(() => {
    const source = SUPPORTED_LANGUAGES.filter(
      (language) => language.code !== selectedTargetLanguage
    );
    const query = searchQuery.trim().toLowerCase();
    if (!query) return source;
    return source.filter((language) => language.name.toLowerCase().includes(query));
  }, [searchQuery, selectedTargetLanguage]);

  const selectedKnownCount = selectedKnownLanguages.length;
  const continueDisabled =
    saving || (step === 1 ? !selectedTargetLanguage : selectedKnownCount === 0);

  const isKnownSelected = (code: string) =>
    selectedKnownLanguages.some((entry) => entry.code === code);

  const getKnownProficiency = (code: string) =>
    selectedKnownLanguages.find((entry) => entry.code === code)?.proficiency;

  const toggleKnownLanguage = (code: string) => {
    if (isKnownSelected(code)) {
      setSelectedKnownLanguages((current) => current.filter((entry) => entry.code !== code));
      return;
    }
    setSelectedKnownLanguages((current) => [
      ...current,
      { code, proficiency: "conversational" }
    ]);
  };

  const setKnownProficiency = (code: string, proficiency: Proficiency) => {
    setSelectedKnownLanguages((current) =>
      current.map((entry) => (entry.code === code ? { ...entry, proficiency } : entry))
    );
  };

  const handleContinue = async () => {
    setError("");
    if (step === 1) {
      if (!selectedTargetLanguage) return;
      setSearchQuery("");
      setStep(2);
      return;
    }

    if (!selectedTargetLanguage || selectedKnownCount === 0) {
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

      const target = SUPPORTED_LANGUAGES.find((language) => language.code === selectedTargetLanguage);
      if (!target) {
        throw new Error("Invalid target language.");
      }

      const { error: deleteError } = await supabase
        .from("user_languages")
        .delete()
        .eq("user_id", user.id);
      if (deleteError) {
        throw deleteError;
      }

      const targetRow = {
        user_id: user.id,
        language_code: target.code,
        language_name: target.name,
        proficiency: "fluent" as Proficiency,
        is_target: true
      };

      const knownRows = selectedKnownLanguages.map((entry) => {
        const language = SUPPORTED_LANGUAGES.find((item) => item.code === entry.code);
        return {
          user_id: user.id,
          language_code: entry.code,
          language_name: language?.name ?? entry.code,
          proficiency: entry.proficiency,
          is_target: false
        };
      });

      const { error: insertError } = await supabase
        .from("user_languages")
        .insert([targetRow, ...knownRows]);

      if (insertError) {
        throw insertError;
      }

      router.push("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save languages.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingSetup) {
    return (
      <main className="p-6 text-sm text-slate-600">Checking your language setup...</main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-6 pt-8">
        <span className="font-serif text-2xl text-[#2D6A4F] font-normal">Bridgr</span>
        <span className="text-sm text-muted-foreground">{step} of 2</span>
      </div>

      <div className="px-6 mt-8">
        <h1 className="font-serif text-3xl font-normal text-foreground text-balance">
          {step === 1 ? "What are you learning?" : "What do you already speak?"}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {step === 1
            ? "Choose the language you want to master"
            : "We'll use these to build smarter hints"}
        </p>
      </div>

      <div className="px-6 mt-6">
        <input
          type="text"
          placeholder="Search languages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-input bg-card h-12 px-4 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      <div className="px-6 mt-4 pb-28 space-y-3">
        {(step === 1 ? step1Languages : step2Languages).map((language) => {
          if (step === 1) {
            const isSelected = selectedTargetLanguage === language.code;
            return (
              <button
                key={language.code}
                onClick={() => setSelectedTargetLanguage(language.code)}
                className={`w-full flex items-center rounded-2xl border py-4 px-5 transition-all ${
                  isSelected
                    ? "border-primary bg-[#E8F5EE]"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <span className="text-2xl">{language.flag}</span>
                <span className="ml-4 text-base font-medium text-foreground">
                  {language.name}
                </span>
                <div className="ml-auto">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected ? <div className="w-2 h-2 rounded-full bg-primary-foreground" /> : null}
                  </div>
                </div>
              </button>
            );
          }

          const selected = isKnownSelected(language.code);
          const proficiency = getKnownProficiency(language.code);

          return (
            <div
              key={language.code}
              className={`w-full rounded-2xl border transition-all ${
                selected ? "border-primary bg-[#E8F5EE]" : "border-border bg-card"
              }`}
            >
              <button
                onClick={() => toggleKnownLanguage(language.code)}
                className="w-full flex items-center py-4 px-5"
              >
                <span className="text-2xl">{language.flag}</span>
                <span className="ml-4 text-base font-medium text-foreground">
                  {language.name}
                </span>
                <div className="ml-auto">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                      selected ? "bg-primary" : "border-2 border-muted-foreground/40"
                    }`}
                  />
                </div>
              </button>

              {selected ? (
                <div className="px-5 pb-4 flex gap-2">
                  {proficiencyLevels.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setKnownProficiency(language.code, level.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        proficiency === level.value
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 py-4">
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        <Button
          onClick={() => void handleContinue()}
          disabled={continueDisabled}
          className="w-full bg-primary text-primary-foreground rounded-2xl py-4 h-auto font-semibold text-base hover:bg-primary/90"
        >
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
