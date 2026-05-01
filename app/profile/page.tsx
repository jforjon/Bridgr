import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserLanguage } from "@/types";
import ProfileScreenClient from "./ProfileScreenClient";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profileData }, { data: languageData }, { count: flashcardCount }, { data: progressRows }] =
    await Promise.all([
      supabase.from("profiles").select("name,email").eq("id", user.id).maybeSingle(),
      supabase.from("user_languages").select("*").eq("user_id", user.id),
      supabase
        .from("flashcards")
        .select("*", { head: true, count: "exact" })
        .eq("user_id", user.id),
      supabase.from("lesson_progress").select("streak_days").eq("user_id", user.id)
    ]);

  const languages = (languageData ?? []) as UserLanguage[];
  const streak = (progressRows ?? []).reduce(
    (max, row) => Math.max(max, row.streak_days ?? 0),
    0
  );

  return (
    <ProfileScreenClient
      userId={user.id}
      initialName={(profileData?.name ?? "").trim()}
      email={profileData?.email ?? ""}
      languages={languages}
      wordsLearned={flashcardCount ?? 0}
      streak={streak}
    />
  );
}
