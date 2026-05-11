import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { KnownLanguage, LearningLanguage } from "@/types";
import ProfileScreenClient from "./ProfileScreenClient";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profileData }, { data: knownLanguageData }, { data: learningLanguageData }, { count: flashcardCount }, { data: achievementsData }] =
    await Promise.all([
    supabase
      .from("profiles")
      .select(
        "name,email,native_language_code,native_language_name,weekly_streak,best_weekly_streak"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("known_languages").select("*").eq("user_id", user.id),
    supabase
      .from("learning_languages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("flashcards")
      .select("*", { head: true, count: "exact" })
      .eq("user_id", user.id),
    supabase.from("achievements").select("*").eq("user_id", user.id)
  ]);

  const knownLanguages = (knownLanguageData ?? []) as KnownLanguage[];
  const learningLanguages = (learningLanguageData ?? []) as LearningLanguage[];

  return (
    <ProfileScreenClient
      userId={user.id}
      initialName={(profileData?.name ?? "").trim()}
      email={profileData?.email ?? ""}
      nativeLanguageCode={profileData?.native_language_code ?? null}
      nativeLanguageName={profileData?.native_language_name ?? null}
      knownLanguages={knownLanguages}
      learningLanguages={learningLanguages}
      wordsLearned={flashcardCount ?? 0}
      weeklyStreak={profileData?.weekly_streak ?? 0}
      bestWeeklyStreak={profileData?.best_weekly_streak ?? 0}
      achievementsCount={(achievementsData ?? []).length}
    />
  );
}
