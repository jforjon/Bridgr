import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CEFRLevel, Course, LearningLanguage, Unit } from "@/types";
import LearnHomeClient, { type LanguagePage } from "./LearnHomeClient";

type LearnPageProps = {
  searchParams?: {
    lang?: string;
  };
};

/** Whole months since the user added the language, floored at 0. */
function monthsSince(iso: string | null): number {
  if (!iso) return 0;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, months);
}

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

  const languageCodes = learningLanguages.map((lang) => lang.language_code);
  const today = new Date().toISOString().split("T")[0];

  // Home is a carousel, so every language needs its own numbers — not just the
  // active one. Cards come back in a single query and are tallied per language
  // here rather than as one count query per language.
  const [{ data: courseRows }, { data: cardRows }] = await Promise.all([
    supabase.from("courses").select("*").eq("user_id", user.id).in("language_code", languageCodes),
    supabase.from("flashcards").select("language_code, next_review_date").eq("user_id", user.id)
  ]);

  const courses = (courseRows ?? []) as Course[];
  const courseByCode = new Map(courses.map((course) => [course.language_code, course]));

  const wordsByCode = new Map<string, number>();
  const dueByCode = new Map<string, number>();
  for (const card of (cardRows ?? []) as { language_code: string | null; next_review_date: string | null }[]) {
    const code = card.language_code;
    if (!code) continue;
    wordsByCode.set(code, (wordsByCode.get(code) ?? 0) + 1);
    if (card.next_review_date && card.next_review_date <= today) {
      dueByCode.set(code, (dueByCode.get(code) ?? 0) + 1);
    }
  }

  // The current unit supplies both the level shown in the hero and the title of
  // the reading row.
  let unitsByCourse = new Map<string, Unit[]>();
  if (courses.length > 0) {
    const { data: unitRows } = await supabase
      .from("units")
      .select("*")
      .in(
        "course_id",
        courses.map((course) => course.id)
      )
      .order("order_index", { ascending: true });

    for (const unit of (unitRows ?? []) as Unit[]) {
      const list = unitsByCourse.get(unit.course_id) ?? [];
      list.push(unit);
      unitsByCourse.set(unit.course_id, list);
    }
  }

  const weeklyGoal = Math.max(1, profile?.weekly_goal ?? 3);
  const sessionsThisWeek = Math.max(0, profile?.sessions_this_week ?? 0);

  const pages: LanguagePage[] = learningLanguages.map((lang) => {
    const course = courseByCode.get(lang.language_code) ?? null;
    const units = course ? (unitsByCourse.get(course.id) ?? []) : [];
    const currentUnit = units.find((unit) => unit.status === "available") ?? null;
    const cardsDue = dueByCode.get(lang.language_code) ?? 0;

    return {
      code: lang.language_code,
      name: lang.language_name,
      level: (currentUnit?.cefr_level as CEFRLevel | undefined) ?? lang.cefr_level,
      wordCount: wordsByCode.get(lang.language_code) ?? 0,
      monthsLearning: monthsSince(lang.created_at),
      cardsDue,
      hasCourse: Boolean(course),
      currentUnitTitle: currentUnit?.title ?? null,
      hasAvailableWork: units.some((unit) => unit.status === "available")
    };
  });

  const requestedLang = searchParams?.lang?.toLowerCase().trim();
  const initialIndex = Math.max(
    0,
    pages.findIndex((page) => page.code.toLowerCase() === requestedLang)
  );

  return (
    <LearnHomeClient
      name={profile?.name ?? null}
      pages={pages}
      initialIndex={initialIndex}
      weeklyGoal={weeklyGoal}
      sessionsThisWeek={sessionsThisWeek}
      reviewCount={pages.reduce((total, page) => total + page.cardsDue, 0)}
    />
  );
}
