import Link from "next/link";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/server";
import { SUPPORTED_LANGUAGES } from "@/types";
import type { KnownLanguage, LearningLanguage } from "@/types";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = new Date().toISOString().slice(0, 10);
  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = `${today}T23:59:59.999Z`;

  const [
    { data: profileData },
    { data: knownLanguageData },
    { data: learningLanguageData },
    { count: dueCount },
    { count: totalFlashcardsCount },
    { count: todayWordsCount, error: todayWordsError },
    { data: progressRows }
  ] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    supabase.from("known_languages").select("*").eq("user_id", user.id),
    supabase
      .from("learning_languages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("flashcards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("next_review_date", today),
    supabase
      .from("flashcards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("flashcards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),
    supabase.from("lesson_progress").select("streak_days").eq("user_id", user.id)
  ]);

  if (todayWordsError) {
    console.log("Dashboard today words query fallback to 0:", todayWordsError);
  }

  const name = (profileData?.name ?? "").trim() || "there";
  const knownLanguages = (knownLanguageData ?? []) as KnownLanguage[];
  const learningRows = (learningLanguageData ?? []) as LearningLanguage[];
  const streak = (progressRows ?? []).reduce(
    (max, row) => Math.max(max, row.streak_days ?? 0),
    0
  );
  const dueWords = dueCount ?? 0;
  const todayWords = todayWordsError ? 0 : todayWordsCount ?? 0;
  const totalWords = totalFlashcardsCount ?? 0;
  const hasLearningLanguage = learningRows.length > 0;
  const firstLearningCode = learningRows[0]?.language_code?.toLowerCase().trim() ?? "";
  const startLessonHref =
    firstLearningCode.length > 0
      ? `/learn/${encodeURIComponent(firstLearningCode)}`
      : "/languages/add";

  return (
    <div className="min-h-screen bg-[#F8FAF9] relative pb-20">
      <header className="px-5 pt-6 pb-4">
        <h1 className="font-serif text-2xl text-[#2D6A4F] font-normal">Bridgr</h1>
      </header>

      <section className="px-5 mb-6">
        <h2 className="font-serif text-3xl font-normal text-[#0F1A14]">
          {getGreeting()}, {name}
        </h2>
        <p className="text-sm text-slate-500 mt-1">🔥 {streak} day streak</p>
      </section>

      <section className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="py-4 rounded-2xl bg-white border-0 shadow-sm flex flex-col items-center justify-center gap-0">
            <span className="text-xs text-slate-500">Today</span>
            <span className="text-2xl font-bold text-[#0F1A14]">{todayWords}</span>
            <span className="text-xs text-slate-500">words</span>
          </div>
          <div className="py-4 rounded-2xl bg-white border-0 shadow-sm flex flex-col items-center justify-center gap-0">
            <span className="text-xs text-slate-500">Total</span>
            <span className="text-2xl font-bold text-[#0F1A14]">{totalWords}</span>
            <span className="text-xs text-slate-500">words</span>
          </div>
          <div className="py-4 rounded-2xl bg-white border-0 shadow-sm flex flex-col items-center justify-center gap-0">
            <span className="text-xs text-slate-500">Streak</span>
            <span className="text-2xl font-bold text-[#0F1A14]">{streak}</span>
            <span className="text-xs text-slate-500">days</span>
          </div>
        </div>
      </section>

      {hasLearningLanguage ? (
        <section className="px-5 mb-6 flex flex-col gap-3">
          <Link
            href={startLessonHref}
            className="w-full bg-[#2D6A4F] text-white rounded-2xl py-4 font-semibold text-base text-center"
          >
            Start lesson
          </Link>
          <Link
            href="/review"
            className="w-full bg-transparent border-2 border-[#2D6A4F] text-[#2D6A4F] rounded-2xl py-4 font-semibold text-base text-center"
          >
            Review {dueWords} due words
          </Link>
          <Link
            href="/learn/reading"
            className="w-full bg-transparent border border-slate-300 text-slate-600 rounded-2xl py-4 font-semibold text-base text-center"
          >
            Practice reading
          </Link>
        </section>
      ) : null}

      <section className="px-5 mb-24 flex flex-col gap-3">
        {learningRows.length > 0 ? (
          <>
            {learningRows.map((row) => {
              const rowFlag =
                SUPPORTED_LANGUAGES.find((entry) => entry.code === row.language_code)?.flag ?? "🌍";
              return (
                <div
                  key={row.id}
                  className="rounded-2xl border-0 bg-white p-5 shadow-sm"
                >
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">LEARNING</span>
                  <h3 className="mt-2 font-serif text-xl text-[#0F1A14]">
                    <span className="mr-2">{rowFlag}</span>
                    {row.language_name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Level{" "}
                    <span className="font-semibold text-[#2D6A4F]">{row.cefr_level}</span>
                  </p>
                </div>
              );
            })}
            <div className="rounded-2xl border-0 bg-white p-5 shadow-sm">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">
                LANGUAGES YOU SPEAK
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                {knownLanguages.length > 0 ? (
                  knownLanguages.map((language) => {
                    const flag =
                      SUPPORTED_LANGUAGES.find((entry) => entry.code === language.language_code)?.flag ??
                      "🌍";
                    return (
                      <span
                        key={language.id}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600"
                      >
                        {flag} {language.language_name}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-sm text-slate-500">No known languages set</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
            <p className="mb-2 font-serif text-xl text-[#0F1A14]">What do you want to learn?</p>
            <p className="mb-4 text-sm text-slate-500">
              Pick a language and we&apos;ll build your personal course
            </p>
            <Link
              href="/languages/add"
              className="inline-block rounded-2xl bg-[#2D6A4F] px-6 py-3 font-medium text-white"
            >
              Choose a language
            </Link>
          </div>
        )}
      </section>

      <BottomNav activeTab="home" hasLearningLanguage={hasLearningLanguage} />
    </div>
  );
}
