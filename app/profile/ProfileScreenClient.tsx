"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { Proficiency, UserLanguage } from "@/types";

interface ProfileScreenClientProps {
  userId: string;
  initialName: string;
  email: string;
  languages: UserLanguage[];
  wordsLearned: number;
  streak: number;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getProficiencyBadgeClass(proficiency: Proficiency) {
  if (proficiency === "fluent") return "bg-emerald-50 text-emerald-700";
  if (proficiency === "conversational") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export default function ProfileScreenClient({
  userId,
  initialName,
  email,
  languages,
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

  const targetLanguage = useMemo(
    () => languages.find((language) => language.is_target) ?? null,
    [languages]
  );
  const knownLanguages = useMemo(
    () => languages.filter((language) => !language.is_target),
    [languages]
  );
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
      ["th", "🇹🇭"]
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
        <p className="mb-3 text-xs uppercase tracking-widest text-slate-500">Learning</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {targetLanguage
                ? languageFlagsByCode.get(targetLanguage.language_code) ?? "🌍"
                : "🌍"}
            </span>
            <span className="font-medium text-slate-900">
              {targetLanguage?.language_name ?? "No target language set"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push("/onboarding")}
            className="text-sm text-[#2D6A4F]"
          >
            Change
          </button>
        </div>

        <div className="my-3 h-px bg-slate-100" />

        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-slate-500">I speak</p>
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
                  className={`rounded-full px-3 py-1 text-xs capitalize ${getProficiencyBadgeClass(
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

      <BottomNav activeTab="profile" />
    </main>
  );
}
