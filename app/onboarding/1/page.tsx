"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "h-12 w-full rounded-xl border border-teal-400/30 bg-teal-850 px-4 text-white placeholder:text-teal-300 outline-none focus:border-lime-300";

const bottomBar =
  "fixed bottom-0 left-0 right-0 z-50 border-t border-teal-700/50 bg-teal-900 px-6 py-4";

export default function OnboardingStepOnePage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canContinue = name.trim().length >= 1 && !saving;

  const handleContinue = async () => {
    const cleanedName = name.trim();
    if (!cleanedName) return;

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
        .update({ name: cleanedName })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      router.push("/onboarding/2");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1 className="font-sans text-3xl font-extrabold text-white">What should we call you?</h1>
      <div className="mt-6">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          className={inputClass}
        />
      </div>

      <div className={bottomBar}>
        <div className="mx-auto w-full max-w-[480px]">
          {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!canContinue}
            className="h-auto min-h-0 w-full rounded-full border-0 bg-lime-300 py-4 text-base font-extrabold text-lime-700 hover:bg-lime-300/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </>
  );
}
