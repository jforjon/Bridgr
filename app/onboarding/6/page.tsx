"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { setupBeginnerCourseAndSkeleton } from "@/lib/beginner-course-flow";
import { LEARNING_LANGUAGE_OPTIONS, ONBOARDING_LANGUAGE_STORAGE_KEY } from "../shared";

const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const timeInputClass =
  "field-input";

const bottomBar =
  "px-page fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg)] py-4";

function resolveLanguageName(code: string): string {
  return LEARNING_LANGUAGE_OPTIONS.find((language) => language.code === code)?.name ?? code;
}

function OnboardingStepSixContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [notificationDays, setNotificationDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [notificationTime, setNotificationTime] = useState("09:00");
  const [languageCode, setLanguageCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [beginnerBuilding, setBeginnerBuilding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryLanguage = searchParams.get("language");
    const storedLanguage =
      typeof window !== "undefined" ? window.localStorage.getItem(ONBOARDING_LANGUAGE_STORAGE_KEY) : null;
    setLanguageCode(queryLanguage ?? storedLanguage ?? "");
  }, [searchParams]);

  const canContinue = useMemo(() => {
    if (notificationsEnabled === null) return false;
    if (!notificationsEnabled) return true;
    return notificationDays.length > 0 && Boolean(notificationTime);
  }, [notificationsEnabled, notificationDays.length, notificationTime]);

  const toggleDay = (day: string) => {
    setNotificationDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day]
    );
  };

  const saveNotificationPreferences = async () => {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw userError ?? new Error("User not authenticated.");
    }

    const payload = notificationsEnabled
      ? {
          notification_enabled: true,
          notification_days: notificationDays,
          notification_time: notificationTime
        }
      : {
          notification_enabled: false,
          notification_days: [],
          notification_time: ""
        };

    const { error: updateError } = await supabase.from("profiles").update(payload).eq("id", user.id);

    if (updateError) {
      throw updateError;
    }
  };

  const handleContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    setError("");

    try {
      await saveNotificationPreferences();

      if (languageCode) {
        router.push(`/placement/${languageCode}`);
      } else {
        setError("Language selection missing. Please go back to step 4.");
        setSaving(false);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
      setSaving(false);
    }
  };

  const handleBeginner = async () => {
    if (!canContinue || !languageCode) return;
    setBeginnerBuilding(true);
    setError("");

    try {
      await saveNotificationPreferences();
      await setupBeginnerCourseAndSkeleton({
        languageCode,
        languageName: resolveLanguageName(languageCode)
      });
      router.push("/learn");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
      setBeginnerBuilding(false);
    }
  };

  const busy = saving || beginnerBuilding;

  return (
    <>
      <h1 className="font-sans text-3xl font-semibold text-[var(--text-1)]">Would you like practice reminders?</h1>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => setNotificationsEnabled(true)}
          className={`w-full rounded-xl border p-4 text-left ${
            notificationsEnabled ? "border-[var(--accent-text)] bg-[var(--surface-2)]" : "border-[var(--border)] bg-[var(--surface-1)]"
          }`}
        >
          <span className="text-base font-bold text-[var(--text-1)]">Yes, remind me</span>
        </button>
        <button
          type="button"
          onClick={() => setNotificationsEnabled(false)}
          className={`w-full rounded-xl border p-4 text-left ${
            notificationsEnabled === false ? "border-[var(--accent-text)] bg-[var(--surface-2)]" : "border-[var(--border)] bg-[var(--surface-1)]"
          }`}
        >
          <span className="text-base font-bold text-[var(--text-1)]">No thanks</span>
        </button>
      </div>

      {notificationsEnabled ? (
        <div className="mt-6 space-y-5">
          <div>
            <p className="mb-2 text-sm font-bold text-[var(--text-1)]">Days</p>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => {
                const selected = notificationDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-full border px-3 py-2 text-sm font-bold ${
                      selected
                        ? "border-[var(--accent-text)] bg-accent-fill text-accent-ink"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--text-1)]" htmlFor="notification-time">
              Time
            </label>
            <input
              id="notification-time"
              type="time"
              value={notificationTime}
              onChange={(event) => setNotificationTime(event.target.value)}
              className={timeInputClass}
            />
          </div>
        </div>
      ) : null}

      <div className={bottomBar}>
        <div className="mx-auto w-full max-w-[480px] space-y-3">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!canContinue || busy}
            fullWidth
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
          <button
            type="button"
            onClick={() => void handleBeginner()}
            disabled={!canContinue || !languageCode || busy}
            className="w-full rounded-full bg-[var(--surface-2)] py-4 text-center text-base font-semibold text-[var(--accent-text)] disabled:opacity-50"
          >
            {beginnerBuilding ? "Building your course..." : "I\u2019m a complete beginner"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function OnboardingStepSixPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--text-2)]">Loading…</p>}>
      <OnboardingStepSixContent />
    </Suspense>
  );
}
