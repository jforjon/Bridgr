"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconBooks, IconFlame, IconStar, IconWorld } from "@tabler/icons-react";
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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
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
    return "border border-teal-400/30 bg-teal-850 text-teal-200";
  }
  if (level === "B1" || level === "B2") {
    return "border border-amber/20 bg-amber/10 text-amber";
  }
  if (level === "C1" || level === "C2") {
    return "border border-lime-300/20 bg-lime-300/10 text-lime-300";
  }
  return "border border-teal-400/30 bg-teal-850 text-teal-200";
}

export default function ProfileScreenClient({
  userId,
  initialName,
  email,
  nativeLanguageCode,
  nativeLanguageName,
  knownLanguages,
  learningLanguages,
  wordsLearned,
  weeklyStreak,
  bestWeeklyStreak,
  achievementsCount
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
  const initials = getInitials(name || email || "?");
  const nativeNameTrimmed = nativeLanguageName?.trim() ?? "";
  const nativeFlagFromMap = nativeLanguageCode
    ? languageFlagsByCode.get(nativeLanguageCode)
    : undefined;

  return (
    <main className="min-h-screen bg-teal-900 pb-28">
      <header className="flex items-center justify-between px-5 pt-8">
        <h1 className="font-sans text-2xl font-extrabold text-white">Profile</h1>
        <Link
          href="/settings"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-teal-400/30 bg-teal-800 text-teal-200"
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </header>

      <section className="mt-6 px-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-600">
          <span className="font-sans text-2xl font-extrabold text-white">{initials}</span>
        </div>
        <h2 className="mt-3 font-sans text-2xl font-extrabold text-white">{name || "No name"}</h2>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-teal-200">
          {!nativeNameTrimmed ? (
            <>
              <IconWorld size={16} className="shrink-0 text-teal-300" stroke={1.75} aria-hidden />
              <span>Native language not set</span>
            </>
          ) : (
            <>
              {nativeFlagFromMap ? (
                <span className="text-base leading-none" aria-hidden>
                  {nativeFlagFromMap}
                </span>
              ) : (
                <IconWorld size={16} className="shrink-0 text-teal-300" stroke={1.75} aria-hidden />
              )}
              <span>{nativeNameTrimmed}</span>
            </>
          )}
        </p>
      </section>

      <section className="mt-8 px-5">
        <h3 className="mb-4 font-sans text-xl font-extrabold text-white">Achievements</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-teal-400/30 bg-teal-800 p-4 text-center">
            <div className="flex justify-center">
              <IconFlame size={28} className="text-amber" stroke={1.75} aria-hidden />
            </div>
            <p className="mt-2 font-sans text-2xl font-extrabold text-white">{weeklyStreak}</p>
            <p className="mt-1 text-xs text-teal-300">week streak</p>
          </div>
          <div className="rounded-xl border border-teal-400/30 bg-teal-800 p-4 text-center">
            <div className="flex justify-center">
              <IconStar size={28} className="text-amber" stroke={1.75} aria-hidden />
            </div>
            <p className="mt-2 font-sans text-2xl font-extrabold text-white">{bestWeeklyStreak}</p>
            <p className="mt-1 text-xs text-teal-300">week best</p>
          </div>
          <div className="rounded-xl border border-teal-400/30 bg-teal-800 p-4 text-center">
            <div className="flex justify-center">
              <IconBooks size={28} className="text-lime-300" stroke={1.75} aria-hidden />
            </div>
            <p className="mt-2 font-sans text-2xl font-extrabold text-white">{wordsLearned}</p>
            <p className="mt-1 text-xs text-teal-300">words</p>
          </div>
          <div className="rounded-xl border border-teal-400/30 bg-teal-800 p-4 text-center">
            <div className="flex justify-center">
              <IconWorld size={28} className="text-lime-300" stroke={1.75} aria-hidden />
            </div>
            <p className="mt-2 font-sans text-2xl font-extrabold text-white">{learningList.length}</p>
            <p className="mt-1 text-xs text-teal-300">languages</p>
          </div>
        </div>
      </section>

      <section className="mt-8 px-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-300">Learning</p>

        {!hasLearning ? (
          <div className="rounded-xl border border-teal-400/30 bg-teal-800 p-5">
            <p className="text-sm text-teal-200">No learning languages yet.</p>
            <Link href="/onboarding/4" className="mt-2 inline-block text-sm font-extrabold text-lime-300">
              Add a language
            </Link>
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border border-teal-400/30 bg-teal-800 p-4">
            {learningList.map((language) => (
              <div
                key={language.id}
                className="flex items-center justify-between gap-3 border-b border-teal-400/20 pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="flex shrink-0 items-center text-xl leading-none">
                    {languageFlagsByCode.get(language.language_code) ?? (
                      <IconWorld size={20} className="text-teal-300" stroke={1.75} aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 truncate font-bold text-white">{language.language_name}</span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getProficiencyBadgeClass(
                      language.cefr_level
                    )}`}
                  >
                    {language.cefr_level}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveTarget(language)}
                  className="shrink-0 rounded-lg p-1 text-teal-400 hover:text-red-400"
                  aria-label={`Remove ${language.language_name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Link href="/onboarding/4" className="mt-3 inline-block text-sm font-extrabold text-lime-300">
          + Add a language
        </Link>
      </section>

      {removeTarget ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 px-4 pt-40"
          role="presentation"
          onClick={() => !removing && setRemoveTarget(null)}
        >
          <div
            className="mx-auto max-w-sm rounded-xl border border-teal-400/30 bg-teal-800 p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-lang-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remove-lang-title" className="font-sans text-xl font-extrabold text-white">
              Remove {removeTarget.language_name}?
            </h2>
            <p className="mt-2 text-sm text-teal-200">
              Your progress will be saved but this language will be removed from your active courses.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={removing}
                onClick={() => setRemoveTarget(null)}
                className="flex-1 rounded-full border border-teal-400/30 px-5 py-2.5 text-sm font-extrabold text-teal-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => void confirmRemoveLanguage()}
                className="flex-1 rounded-full bg-red-600 px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {removing ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="mt-6 px-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-300">I speak</p>
          <button
            type="button"
            onClick={() => router.push("/onboarding/3")}
            className="text-sm font-extrabold text-lime-300"
          >
            Edit
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-teal-400/30 bg-teal-800 p-4">
          {knownLanguages.length > 0 ? (
            knownLanguages.map((language) => (
              <div key={language.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center text-xl leading-none">
                    {languageFlagsByCode.get(language.language_code) ?? (
                      <IconWorld size={20} className="text-teal-300" stroke={1.75} aria-hidden />
                    )}
                  </span>
                  <span className="text-sm font-medium text-white">{language.language_name}</span>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${getProficiencyBadgeClass(
                    language.proficiency
                  )}`}
                >
                  {language.proficiency}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-teal-200">No known languages set</p>
          )}
        </div>
      </section>

      {achievementsCount === 0 ? (
        <p className="mt-4 px-5 text-xs text-teal-300">No achievement rows yet.</p>
      ) : null}

      <BottomNav activeTab="profile" hasLearningLanguage={hasLearning} />
    </main>
  );
}
