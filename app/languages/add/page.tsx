"use client";

import Link from "next/link";
import { IconCheck } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import BridgrPageLoading from "@/components/BridgrPageLoading";
import { createClient } from "@/lib/supabase/client";
import type { LearningLanguage } from "@/types";

const TARGET_LANGUAGE_OPTIONS = [
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "ca", name: "Catalan", flag: "🏴" },
  { code: "en", name: "English", flag: "🇬🇧" }
] as const;

type TargetCode = (typeof TARGET_LANGUAGE_OPTIONS)[number]["code"];

export default function AddLearningLanguagePage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [learningCodes, setLearningCodes] = useState<Set<string>>(new Set());
  const [selectedCode, setSelectedCode] = useState<TargetCode | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?redirectedFrom=/languages/add");
        return;
      }

      const { data: rows, error: fetchError } = await supabase
        .from("learning_languages")
        .select("language_code")
        .eq("user_id", user.id);

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const typed = (rows ?? []) as Pick<LearningLanguage, "language_code">[];
      setLearningCodes(new Set(typed.map((r) => r.language_code)));
      setLoading(false);
    };

    void load();
  }, [router, supabase]);

  const availableLanguages = useMemo(
    () => TARGET_LANGUAGE_OPTIONS.filter((lang) => !learningCodes.has(lang.code)),
    [learningCodes]
  );

  const startPlacement = () => {
    if (!selectedCode) return;
    router.push(`/placement/${selectedCode}`);
  };

  if (loading) {
    return (
      <BridgrPageLoading
        title="Loading languages…"
        subtitle="Checking what you’re already learning"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-32">
      <header className="px-page grid grid-cols-[1fr_auto_1fr] items-center gap-2 pt-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="justify-self-start rounded-lg p-1 text-[var(--text-2)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-sans text-xl font-semibold text-[var(--text-1)]">Choose a language</h1>
        <span aria-hidden className="justify-self-end w-6" />
      </header>

      <div className="px-page mt-8">
        <h2 className="font-sans text-3xl font-semibold text-[var(--text-1)]">What do you want to learn?</h2>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          We&apos;ll build you a personalised course based on your language background
        </p>
      </div>

      {error ? (
        <p className="px-page mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="px-page mt-6 space-y-3">
        {availableLanguages.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-1)] p-8 text-center">
            <p className="text-base text-[var(--text-2)]">
              You&apos;re already learning all our available languages!
            </p>
            <Link
              href="/learn"
              className="mt-4 inline-block text-sm font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
            >
              Back to home
            </Link>
          </div>
        ) : (
          availableLanguages.map((lang) => {
            const selected = selectedCode === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setSelectedCode(lang.code)}
                className={`flex w-full items-center rounded-xl border p-5 text-left transition-colors ${
                  selected ? "border-[var(--accent-text)] bg-[var(--surface-2)]" : "border-[var(--border)] bg-[var(--surface-1)] hover:border-[var(--border)]"
                }`}
              >
                <span className="text-3xl leading-none" aria-hidden>
                  {lang.flag}
                </span>
                <span className="ml-4 font-sans text-xl font-semibold text-[var(--text-1)]">{lang.name}</span>
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
            );
          })
        )}
      </div>

      {availableLanguages.length > 0 ? (
        <div className="px-page fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--bg)] py-4">
          <button
            type="button"
            disabled={!selectedCode}
            onClick={startPlacement}
            className="btn-primary w-full"
          >
            Start placement test
          </button>
        </div>
      ) : null}
    </div>
  );
}
