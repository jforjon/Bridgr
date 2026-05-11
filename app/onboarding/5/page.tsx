"use client";

import { IconStar } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { WEEKLY_GOAL_OPTIONS, type WeeklyGoalOption } from "@/types";
import { ONBOARDING_LANGUAGE_STORAGE_KEY } from "../shared";

const bottomBar =
  "fixed bottom-0 left-0 right-0 z-50 border-t border-teal-700/50 bg-teal-900 px-6 py-4";

export default function OnboardingStepFivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoalOption>(3);
  const [languageCode, setLanguageCode] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryLanguage = searchParams.get("language");
    const storedLanguage =
      typeof window !== "undefined" ? localStorage.getItem(ONBOARDING_LANGUAGE_STORAGE_KEY) : null;
    const resolvedLanguage = queryLanguage ?? storedLanguage ?? "";
    setLanguageCode(resolvedLanguage);
  }, [searchParams]);

  const handleContinue = async () => {
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
        .update({ weekly_goal: weeklyGoal })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      const nextUrl = languageCode ? `/onboarding/6?language=${languageCode}` : "/onboarding/6";
      router.push(nextUrl);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1 className="font-sans text-3xl font-extrabold text-white">How often do you want to practice?</h1>
      <p className="mt-3 text-sm text-teal-200">
        Your streak counts by week, not by day — hit your goal each week to keep it going
      </p>

      <div className="mt-6 space-y-3">
        {WEEKLY_GOAL_OPTIONS.map((option) => {
          const selected = weeklyGoal === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setWeeklyGoal(option.value)}
              className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left ${
                selected ? "border-lime-300 bg-lime-300/10" : "border-teal-400/30 bg-teal-800"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">{option.label}</p>
                <p className="text-sm text-teal-200">{option.description}</p>
              </div>
              {option.value === 3 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-lime-300/20 bg-lime-300/10 px-2 py-1 text-xs font-extrabold text-lime-300">
                  <IconStar size={14} className="text-amber" stroke={2} aria-hidden />
                  Recommended
                </span>
              ) : null}
              <span
                className={`h-5 w-5 shrink-0 rounded-full border-2 ${
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
            disabled={saving}
            className="h-auto min-h-0 w-full rounded-full border-0 bg-lime-300 py-4 text-base font-extrabold text-lime-700 hover:bg-lime-300/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </>
  );
}
