"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ONBOARDING_LANGUAGE_STORAGE_KEY } from "../shared";

const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const timeInputClass =
  "h-12 w-full rounded-pill border-none bg-[var(--card-2)] px-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:outline-none";

const bottomBar =
  "fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg)] px-6 py-4";

function OnboardingStepSixContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [notificationDays, setNotificationDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [notificationTime, setNotificationTime] = useState("09:00");
  const [languageCode, setLanguageCode] = useState("");
  const [saving, setSaving] = useState(false);
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

  const handleContinue = async () => {
    if (!canContinue) return;
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

  return (
    <>
      <h1 className="font-sans text-3xl font-extrabold text-[var(--text-primary)]">Would you like practice reminders?</h1>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => setNotificationsEnabled(true)}
          className={`w-full rounded-xl border p-4 text-left ${
            notificationsEnabled ? "border-[var(--accent)] bg-[var(--card-2)]" : "border-[var(--border)] bg-[var(--card)]"
          }`}
        >
          <span className="text-base font-bold text-[var(--text-primary)]">Yes, remind me</span>
        </button>
        <button
          type="button"
          onClick={() => setNotificationsEnabled(false)}
          className={`w-full rounded-xl border p-4 text-left ${
            notificationsEnabled === false ? "border-[var(--accent)] bg-[var(--card-2)]" : "border-[var(--border)] bg-[var(--card)]"
          }`}
        >
          <span className="text-base font-bold text-[var(--text-primary)]">No thanks</span>
        </button>
      </div>

      {notificationsEnabled ? (
        <div className="mt-6 space-y-5">
          <div>
            <p className="mb-2 text-sm font-bold text-[var(--text-primary)]">Days</p>
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
                        ? "border-[var(--accent)] bg-[#BFFF00] text-[#2A3800]"
                        : "border-[var(--border)] bg-[var(--card-2)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--text-primary)]" htmlFor="notification-time">
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
        <div className="mx-auto w-full max-w-[480px]">
          {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!canContinue || saving}
            className="h-auto min-h-0 w-full rounded-pill bg-[#BFFF00] py-4 text-base font-extrabold text-[#2A3800] hover:bg-[#A8E000] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </>
  );
}

export default function OnboardingStepSixPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--text-secondary)]">Loading…</p>}>
      <OnboardingStepSixContent />
    </Suspense>
  );
}
