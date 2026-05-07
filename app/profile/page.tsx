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

  const [
    { data: profileData },
    { data: knownLanguageData },
    { data: learningLanguageData },
    { count: flashcardCount },
    { data: progressRows }
  ] = await Promise.all([
    supabase.from("profiles").select("name,email").eq("id", user.id).maybeSingle(),
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
    supabase.from("lesson_progress").select("streak_days").eq("user_id", user.id)
  ]);

  const knownLanguages = (knownLanguageData ?? []) as KnownLanguage[];
  const learningLanguages = (learningLanguageData ?? []) as LearningLanguage[];
  const streak = (progressRows ?? []).reduce(
    (max, row) => Math.max(max, row.streak_days ?? 0),
    0
  );

  return (
    <ProfileScreenClient
      userId={user.id}
      initialName={(profileData?.name ?? "").trim()}
      email={profileData?.email ?? ""}
      knownLanguages={knownLanguages}
      learningLanguages={learningLanguages}
      wordsLearned={flashcardCount ?? 0}
      streak={streak}
    />
  );
}
