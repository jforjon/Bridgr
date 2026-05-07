"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { KnownLanguage, LearningLanguage } from "@/types";

interface ProfileScreenClientProps {
  userId: string;
  initialName: string;
  email: string;
  knownLanguages: KnownLanguage[];
  learningLanguages: LearningLanguage[];
  wordsLearned: number;
  streak: number;
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
    return "border border-blue-200 bg-blue-50 text-blue-600";
  }
  if (level === "B1" || level === "B2") {
    return "border border-amber-200 bg-amber-50 text-amber-600";
  }
  if (level === "C1" || level === "C2") {
    return "border border-green-200 bg-green-50 text-green-700";
  }
  return "border border-slate-200 bg-slate-100 text-slate-600";
}

export default function ProfileScreenClient({
  userId,
  initialName,
  email,
  knownLanguages,
  learningLanguages,
  wordsLearned,
  streak
}: ProfileScreenClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(initialName);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
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

  useEffect(() => {
    if (!savedName) return;
    const timeout = window.setTimeout(() => setSavedName(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [savedName]);

  const saveName = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setError("Please enter your name");
      return;
    }

    setError("");
    setSavingName(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ name: trimmed })
      .eq("id", userId);
    setSavingName(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setName(trimmed);
    setEditingName(false);
    setSavedName(true);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

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

  return (
    <main className="pb-28">
      <header className="pt-8">
        <h1 className="font-serif text-2xl text-slate-900">Profile</h1>
      </header>

      <section className="mt-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2D6A4F]">
          <span className="font-serif text-2xl text-white">{getInitials(name)}</span>
        </div>
        <h2 className="mt-4 font-serif text-2xl text-slate-900">{name || "No name"}</h2>
        <p className="mt-1 text-sm text-slate-500">{email}</p>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5">
        <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Name</p>
        {!editingName ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-medium text-slate-900">{name || "Not set"}</p>
            <button
              type="button"
              onClick={() => {
                setDraftName(name);
                setEditingName(true);
                setError("");
              }}
              className="text-sm text-[#2D6A4F]"
            >
              Edit
            </button>
          </div>
        ) : (
          <div>
            <input
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftName(name);
                  setEditingName(false);
                  setError("");
                }}
                className="text-sm text-slate-500"
                disabled={savingName}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveName()}
                className="text-sm text-[#2D6A4F]"
                disabled={savingName}
              >
                {savingName ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
        {savedName ? <p className="mt-2 text-sm text-[#2D6A4F]">Saved</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="mt-4 rounded-2xl border border-slate-100 bg-white p-5">
        <p className="mb-3 text-xs uppercase tracking-widest text-slate-500">
          Languages I&apos;m learning
        </p>

        {!hasLearning ? (
          <div>
            <p className="text-sm text-slate-500">No languages yet</p>
            <Link href="/languages/add" className="mt-2 inline-block text-sm font-medium text-[#2D6A4F]">
              Add a language
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {learningList.map((language) => (
              <div
                key={language.id}
                className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="text-xl shrink-0">
                    {languageFlagsByCode.get(language.language_code) ?? "🌍"}
                  </span>
                  <span className="min-w-0 truncate font-medium text-slate-900">{language.language_name}</span>
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
                  className="shrink-0 rounded-lg p-1 text-slate-300 hover:text-red-400"
                  aria-label={`Remove ${language.language_name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Link href="/languages/add" className="mt-2 inline-block text-sm font-medium text-[#2D6A4F]">
              Add a language
            </Link>
          </div>
        )}
      </section>

      {removeTarget ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 px-4 pt-40"
          role="presentation"
          onClick={() => !removing && setRemoveTarget(null)}
        >
          <div
            className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-lang-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remove-lang-title" className="font-serif text-xl text-[#0F1A14]">
              Remove {removeTarget.language_name}?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Your progress will be saved but this language will be removed from your active courses.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={removing}
                onClick={() => setRemoveTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => void confirmRemoveLanguage()}
                className="flex-1 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {removing ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="mt-4 rounded-2xl border border-slate-100 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-slate-500">Languages I speak</p>
          <button
            type="button"
            onClick={() => router.push("/onboarding")}
            className="text-sm text-[#2D6A4F]"
          >
            Edit
          </button>
        </div>

        <div className="space-y-2">
          {knownLanguages.length > 0 ? (
            knownLanguages.map((language) => (
              <div key={language.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {languageFlagsByCode.get(language.language_code) ?? "🌍"}
                  </span>
                  <span className="text-sm text-slate-800">{language.language_name}</span>
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
            <p className="text-sm text-slate-500">No known languages set</p>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-100 bg-white p-5">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-slate-600">Words learned</span>
          <span className="text-sm font-semibold text-slate-900">{wordsLearned}</span>
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-slate-600">Day streak</span>
          <span className="text-sm font-semibold text-slate-900">{streak}</span>
        </div>
      </section>

      <Button
        type="button"
        onClick={() => void signOut()}
        variant="outline"
        className="mt-6 w-full rounded-2xl border-slate-200 py-4 text-slate-600 font-medium"
      >
        Sign out
      </Button>

      <BottomNav activeTab="profile" hasLearningLanguage={hasLearning} />
    </main>
  );
}
