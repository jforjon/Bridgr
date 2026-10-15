"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconWorld } from "@tabler/icons-react";
import { Settings, X } from "lucide-react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/client";
import type { KnownLanguage, LearningLanguage } from "@/types";

interface ProfileScreenClientProps {
  userId: string;
  initialName: string;
  email: string;
  nativeLanguageCode: string | null;
  nativeLanguageName: string | null;
  knownLanguages: KnownLanguage[];
  learningLanguages: LearningLanguage[];
  wordsLearned: number;
  weeklyStreak: number;
  bestWeeklyStreak: number;
  achievementsCount: number;
}

function getProficiencyBadgeClass(proficiency: string): string {
  const level =
    proficiency === "basic"
      ? "A2"
      : proficiency === "conversational"
        ? "B1"
        : proficiency === "fluent"
          ? "C1"
          : proficiency;
  if (level === "A1" || level === "A2") {
    return "border border-line bg-card-2 text-ink-secondary";
  }
  if (level === "B1" || level === "B2") {
    return "border border-warning/30 bg-warning-soft text-warning";
  }
  if (level === "C1" || level === "C2") {
    return "border border-accent/30 bg-accent-soft text-accent";
  }
  return "border border-line bg-card-2 text-ink-secondary";
}

export default function ProfileScreenClient({
  userId,
  initialName,
  nativeLanguageCode,
  nativeLanguageName,
  knownLanguages,
  learningLanguages,
  wordsLearned,
  weeklyStreak,
  bestWeeklyStreak
}: ProfileScreenClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [learningList, setLearningList] = useState<LearningLanguage[]>(learningLanguages);
  const [removeTarget, setRemoveTarget] = useState<LearningLanguage | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setLearningList(learningLanguages);
  }, [learningLanguages]);

  const languageFlagsByCode = useMemo(() => {
    return new Map([
      ["en", "🇬🇧"],
      ["es", "🇪🇸"],
      ["fr", "🇫🇷"],
      ["de", "🇩🇪"],
      ["it", "🇮🇹"],
      ["pt", "🇵🇹"],
      ["nl", "🇳🇱"],
      ["sv", "🇸🇪"],
      ["no", "🇳🇴"],
      ["da", "🇩🇰"],
      ["pl", "🇵🇱"],
      ["ru", "🇷🇺"],
      ["uk", "🇺🇦"],
      ["tr", "🇹🇷"],
      ["ar", "🇸🇦"],
      ["he", "🇮🇱"],
      ["hi", "🇮🇳"],
      ["ja", "🇯🇵"],
      ["ko", "🇰🇷"],
      ["zh", "🇨🇳"],
      ["vi", "🇻🇳"],
      ["th", "🇹🇭"],
      ["ca", "🏴"]
    ]);
  }, []);

  const confirmRemoveLanguage = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    setError("");
    const { error: deleteError } = await supabase
      .from("learning_languages")
      .delete()
      .eq("user_id", userId)
      .eq("language_code", removeTarget.language_code);
    setRemoving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setLearningList((prev) => prev.filter((l) => l.id !== removeTarget.id));
    setRemoveTarget(null);
    router.refresh();
  };

  const hasLearning = learningList.length > 0;
  const nativeNameTrimmed = nativeLanguageName?.trim() ?? "";
  const nativeFlagFromMap = nativeLanguageCode
    ? languageFlagsByCode.get(nativeLanguageCode)
    : undefined;

  return (
    <main className="min-h-screen bg-[var(--bg)] pb-28">
      <header className="px-page flex items-start justify-between gap-4 pt-10">
        <div className="min-w-0">
          <p className="label-caps">Profile</p>
          <h1 className="title-screen mt-1.5 truncate">{name || "No name"}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-ink-secondary">
            {!nativeNameTrimmed ? (
              <span>Native language not set</span>
            ) : (
              <>
                {nativeFlagFromMap ? (
                  <span className="text-base leading-none" aria-hidden>
                    {nativeFlagFromMap}
                  </span>
                ) : null}
                <span>Native {nativeNameTrimmed} speaker</span>
              </>
            )}
          </p>
        </div>
        <Link
          href="/settings"
          className="tap-target flex shrink-0 items-center justify-center text-ink-tertiary transition-colors duration-150 hover:text-ink"
          aria-label="Open settings"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </header>

      {/* Stats — a typographic table bounded by rules, not icon tiles. */}
      <section className="px-page mt-8">
        <div className="ruled grid grid-cols-2">
          <div className="border-b border-r border-line py-5 pr-4">
            <p className="type-serif text-[32px] font-medium leading-none text-ink">{weeklyStreak}</p>
            <p className="mt-1.5 text-[13px] text-ink-secondary">week streak</p>
          </div>
          <div className="border-b border-line py-5 pl-5">
            <p className="type-serif text-[32px] font-medium leading-none text-ink">{bestWeeklyStreak}</p>
            <p className="mt-1.5 text-[13px] text-ink-secondary">best streak</p>
          </div>
          <div className="border-r border-line py-5 pr-4">
            <p className="type-serif text-[32px] font-medium leading-none text-ink">{wordsLearned}</p>
            <p className="mt-1.5 text-[13px] text-ink-secondary">words learned</p>
          </div>
          <div className="py-5 pl-5">
            <p className="type-serif text-[32px] font-medium leading-none text-ink">{learningList.length}</p>
            <p className="mt-1.5 text-[13px] text-ink-secondary">
              {learningList.length === 1 ? "language" : "languages"}
            </p>
          </div>
        </div>
      </section>

      <section className="px-page mt-10">
        <p className="label-caps">Learning</p>

        {!hasLearning ? (
          <div className="border-b border-line py-5">
            <p className="text-sm text-ink-secondary">No learning languages yet.</p>
          </div>
        ) : (
          <div className="mt-1 divide-y divide-[var(--border)] border-b border-line">
            {learningList.map((language) => (
              <div key={language.id} className="flex items-center gap-3 py-4">
                <span className="flex w-7 shrink-0 items-center text-xl leading-none">
                  {languageFlagsByCode.get(language.language_code) ?? (
                    <IconWorld size={20} className="text-ink-tertiary" stroke={1.5} aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                  {language.language_name}
                </span>
                <span
                  className={`shrink-0 rounded-pill px-3 py-1 text-xs font-medium ${getProficiencyBadgeClass(
                    language.cefr_level
                  )}`}
                >
                  {language.cefr_level}
                </span>
                <button
                  type="button"
                  onClick={() => setRemoveTarget(language)}
                  className="tap-target -mr-3 flex shrink-0 cursor-pointer items-center justify-center text-ink-tertiary transition-colors duration-150 hover:text-danger"
                  aria-label={`Remove ${language.language_name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Link href="/onboarding/4" className="btn-quiet -ml-3 mt-3">
          + Add a language
        </Link>
      </section>

      {removeTarget ? (
        <div
          className="px-page fixed inset-0 z-50 bg-[var(--scrim)] pt-40"
          role="presentation"
          onClick={() => !removing && setRemoveTarget(null)}
        >
          <div
            className="modal mx-auto max-w-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-lang-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remove-lang-title" className="font-sans text-xl font-semibold text-[var(--text-1)]">
              Remove {removeTarget.language_name}?
            </h2>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Your progress will be saved but this language will be removed from your active courses.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={removing}
                onClick={() => setRemoveTarget(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => void confirmRemoveLanguage()}
                className="btn-destructive flex-1"
              >
                {removing ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="px-page mt-10">
        <div className="flex items-baseline justify-between">
          <p className="label-caps">I speak</p>
          <button
            type="button"
            onClick={() => router.push("/onboarding/3")}
            className="btn-quiet -mr-3 text-[13px]"
          >
            Edit
          </button>
        </div>

        <div className="mt-1 divide-y divide-[var(--border)] border-b border-line">
          {knownLanguages.length > 0 ? (
            knownLanguages.map((language) => (
              <div key={language.id} className="flex items-center gap-3 py-4">
                <span className="flex w-7 shrink-0 items-center text-xl leading-none">
                  {languageFlagsByCode.get(language.language_code) ?? (
                    <IconWorld size={20} className="text-ink-tertiary" stroke={1.5} aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-[15px] text-ink">{language.language_name}</span>
                <span
                  className={`shrink-0 rounded-pill px-3 py-1 text-xs font-medium ${getProficiencyBadgeClass(
                    language.proficiency
                  )}`}
                >
                  {language.proficiency}
                </span>
              </div>
            ))
          ) : (
            <p className="py-4 text-sm text-ink-secondary">No known languages set</p>
          )}
        </div>
      </section>

      <BottomNav activeTab="profile" hasLearningLanguage={hasLearning} />
    </main>
  );
}
