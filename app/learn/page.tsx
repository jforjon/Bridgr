import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Course, Lesson, LearningLanguage, Unit } from "@/types";
import LearnHomeClient from "./LearnHomeClient";

type LearnPageProps = {
  searchParams?: {
    lang?: string;
  };
};

export default async function LearnPage({ searchParams }: LearnPageProps) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ count: knownCount }, { data: profile }, { data: learningRows }] = await Promise.all([
    supabase.from("known_languages").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("name, weekly_goal, weekly_streak, sessions_this_week, week_start_date")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("learning_languages")
      .select("*")
      .eq("user_id", user.id)
      .order("last_accessed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true })
  ]);

  if ((knownCount ?? 0) === 0) {
    redirect("/onboarding/1");
  }

  const learningLanguages = (learningRows ?? []) as LearningLanguage[];
  if (learningLanguages.length === 0) {
    redirect("/onboarding/4");
  }

  const requestedLang = searchParams?.lang?.toLowerCase().trim();
  const activeLanguage =
    learningLanguages.find((lang) => lang.language_code.toLowerCase() === requestedLang) ??
    learningLanguages[0];

  const { data: courseRow } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", user.id)
    .eq("language_code", activeLanguage.language_code)
    .maybeSingle();

  const course = (courseRow ?? null) as Course | null;
  let units: Unit[] = [];
  let lessonsByUnit: Record<string, Lesson[]> = {};

  if (course) {
    const { data: unitRows } = await supabase
      .from("units")
      .select("*")
      .eq("course_id", course.id)
      .order("order_index", { ascending: true });

    units = (unitRows ?? []) as Unit[];

    if (units.length > 0) {
      const unitIds = units.map((u) => u.id);
      const { data: lessonRows } = await supabase
        .from("lessons")
        .select("*")
        .in("unit_id", unitIds)
        .order("order_index", { ascending: true });

      const grouped: Record<string, Lesson[]> = {};
      for (const unitId of unitIds) grouped[unitId] = [];
      for (const lesson of (lessonRows ?? []) as Lesson[]) {
        if (!grouped[lesson.unit_id]) grouped[lesson.unit_id] = [];
        grouped[lesson.unit_id].push(lesson);
      }
      lessonsByUnit = grouped;
    }
  }

  return (
    <LearnHomeClient
      profile={{
        name: profile?.name ?? null,
        weekly_goal: profile?.weekly_goal ?? 3,
        weekly_streak: profile?.weekly_streak ?? 0,
        sessions_this_week: profile?.sessions_this_week ?? 0,
        week_start_date: profile?.week_start_date ?? null
      }}
      learningLanguages={learningLanguages}
      activeLanguage={activeLanguage}
      course={course}
      units={units}
      lessonsByUnit={lessonsByUnit}
    />
  );
}
