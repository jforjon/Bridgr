"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconBook,
  IconCards,
  IconCheck,
  IconChevronDown,
  IconFileText,
  IconLock,
  IconPlus,
  IconRefresh,
  IconWorld
} from "@tabler/icons-react";
import BottomNav from "@/components/BottomNav";
import BridgrPageLoading from "@/components/BridgrPageLoading";
import { SUPPORTED_LANGUAGES, type Course, type Lesson, type LearningLanguage, type Unit } from "@/types";

type LearnProfile = {
  name: string | null;
  weekly_goal: number;
  weekly_streak: number;
  sessions_this_week: number;
  week_start_date: string | null;
};

type Props = {
  profile: LearnProfile;
  learningLanguages: LearningLanguage[];
  activeLanguage: LearningLanguage;
  course: Course | null;
  units: Unit[];
  lessonsByUnit: Record<string, Lesson[]>;
};

function LanguageFlag({ code }: { code: string }) {
  const flag = SUPPORTED_LANGUAGES.find((l) => l.code === code.toLowerCase())?.flag;
  if (flag) {
    return (
      <span className="text-base leading-none" aria-hidden>
        {flag}
      </span>
    );
  }
  return <IconWorld size={16} className="shrink-0 text-[var(--text-secondary)]" stroke={1.75} aria-hidden />;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const LESSON_ORDER: Lesson["type"][] = ["vocabulary", "grammar", "reading", "review"];

function sortedLessons(lessons: Lesson[]) {
  const byType = new Map(lessons.map((lesson) => [lesson.type, lesson]));
  return LESSON_ORDER.map((type) => byType.get(type)).filter((lesson): lesson is Lesson => Boolean(lesson));
}

function LessonTypeIcon({ type }: { type: Lesson["type"] }) {
  const wrap =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--card-2)]";
  const iconClass = "text-[var(--text-secondary)]";
  const s = 16;
  switch (type) {
    case "vocabulary":
      return (
        <span className={wrap}>
          <IconCards size={s} className={iconClass} stroke={1.75} />
        </span>
      );
    case "grammar":
      return (
        <span className={wrap}>
          <IconBook size={s} className={iconClass} stroke={1.75} />
        </span>
      );
    case "reading":
      return (
        <span className={wrap}>
          <IconFileText size={s} className={iconClass} stroke={1.75} />
        </span>
      );
    case "review":
      return (
        <span className={wrap}>
          <IconRefresh size={s} className={iconClass} stroke={1.75} />
        </span>
      );
    default:
      return <span className={wrap} />;
  }
}

export default function LearnHomeClient({
  profile,
  learningLanguages,
  activeLanguage,
  course,
  units,
  lessonsByUnit
}: Props) {
  const router = useRouter();
  const fallbackOpenUnitId = units.find(
    (u) => u.status === "available" || u.status === "completed"
  )?.id;
  const [isGenerating, setIsGenerating] = useState(false);
  const [beginnerError, setBeginnerError] = useState("");

  const greetingNameRaw = (profile.name ?? "").trim() || "there";
  const greetingName =
    greetingNameRaw === "there"
      ? greetingNameRaw
      : greetingNameRaw.charAt(0).toUpperCase() + greetingNameRaw.slice(1);
  const weeklyGoal = Math.max(1, profile.weekly_goal || 3);
  const sessionsThisWeek = Math.max(0, profile.sessions_this_week || 0);
  const weeklyStreak = Math.max(0, profile.weekly_streak || 0);

  const firstAvailableLesson = useMemo(() => {
    for (const unit of units) {
      const list = sortedLessons(lessonsByUnit[unit.id] ?? []);
      const available = list.find((lesson) => lesson.status === "available");
      if (available) return available;
    }
    return null;
  }, [units, lessonsByUnit]);

  const firstAvailableUnitId = useMemo(() => {
    if (!firstAvailableLesson) return null;
    for (const u of units) {
      if ((lessonsByUnit[u.id] ?? []).some((l) => l.id === firstAvailableLesson.id)) {
        return u.id;
      }
    }
    return null;
  }, [firstAvailableLesson, units, lessonsByUnit]);

  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const openId = firstAvailableUnitId ?? fallbackOpenUnitId;
    if (openId) initial.add(openId);
    return initial;
  });

  const runBeginnerFlow = async () => {
    setBeginnerError("");
    setIsGenerating(true);
    try {
      const submitRes = await fetch("/api/placement/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          skipped: true,
          cefr_level: "A1",
          language_code: activeLanguage.language_code,
          language_name: activeLanguage.language_name
        })
      });

      if (!submitRes.ok) {
        const payload = (await submitRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not save beginner choice.");
      }

      const maxTries = 120;
      for (let i = 0; i < maxTries; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const statusRes = await fetch(
          `/api/course/status?language_code=${encodeURIComponent(activeLanguage.language_code)}`,
          {
            method: "GET",
            credentials: "include"
          }
        );
        const statusPayload = (await statusRes.json().catch(() => ({}))) as { exists?: boolean };
        if (statusRes.ok && statusPayload.exists) {
          router.refresh();
          return;
        }
      }

      throw new Error("Course generation is taking longer than expected. Please try again.");
    } catch (error) {
      setBeginnerError(error instanceof Error ? error.message : String(error));
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <BridgrPageLoading
        title={`Building your ${activeLanguage.language_name} course...`}
        subtitle={null}
        bottomSlot={<BottomNav activeTab="learn" hasLearningLanguage />}
      />
    );
  }

  if (!course) {
    return (
      <>
        <main className="min-h-screen bg-[var(--bg)] pb-28 pt-10">
          <div className="mt-32 px-6 text-center">
            <h1 className="font-sans text-3xl font-extrabold text-[var(--text-primary)]">Welcome, {greetingName}</h1>
            <p className="mx-auto mt-3 max-w-xs text-base text-[var(--text-secondary)]">
              Let&apos;s find your {activeLanguage.language_name} level before building your course
            </p>

            <div className="pointer-events-none mt-8 space-y-3 opacity-30">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="rounded-lg bg-[var(--card)] p-4 blur-[0.3px]"
                >
                  <div className="mb-2 h-4 w-1/3 rounded bg-[var(--card-2)]" />
                  <div className="h-3 w-2/3 rounded bg-[var(--card-2)]" />
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href={`/placement/${encodeURIComponent(activeLanguage.language_code)}`}
                className="block w-full rounded-pill bg-[#BFFF00] py-4 text-center text-base font-extrabold text-[#2A3800] hover:bg-[#A8E000]"
              >
                Take placement test
              </Link>
              <button
                type="button"
                onClick={() => void runBeginnerFlow()}
                className="mt-3 w-full rounded-full bg-[var(--card-2)] py-4 text-center text-base font-extrabold text-[var(--accent)]"
              >
                I&apos;m a complete beginner
              </button>
              <p className="mt-4 text-center text-xs text-[var(--text-secondary)]">
                The placement test takes 2–3 minutes
              </p>
              {beginnerError ? <p className="mt-3 text-sm text-red-400">{beginnerError}</p> : null}
            </div>
          </div>
        </main>
        <BottomNav activeTab="learn" hasLearningLanguage />
      </>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[var(--bg)] pb-24">
        <header className="mt-6 flex items-center justify-between px-5 pb-4">
          <h1 className="max-w-[65%] text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {getGreeting()}, {greetingName}
          </h1>
          {learningLanguages.length > 1 ? (
            <div className="relative inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5">
              <select
                value={activeLanguage.language_code}
                onChange={(event) => router.push(`/learn?lang=${encodeURIComponent(event.target.value)}`)}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                aria-label="Switch learning language"
              >
                {learningLanguages.map((language) => (
                  <option key={language.id} value={language.language_code}>
                    {language.language_name}
                  </option>
                ))}
              </select>
              <LanguageFlag code={activeLanguage.language_code} />
              <span className="pointer-events-none text-sm font-bold text-[var(--text-primary)] whitespace-nowrap">
                {activeLanguage.language_name}
              </span>
              <IconChevronDown size={14} className="pointer-events-none shrink-0 text-[var(--text-secondary)]" stroke={2} />
            </div>
          ) : null}
        </header>

        <section className="mx-5 mt-4 rounded-lg bg-[var(--card)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-5xl font-black tracking-tight text-[var(--accent)]">{weeklyStreak}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                week streak
              </p>
              {weeklyStreak === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Start your streak this week</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                this week
              </p>
              <div className="mt-2 flex flex-row gap-1" aria-hidden>
                {Array.from({ length: weeklyGoal }, (_, i) => (
                  <span
                    key={i}
                    className={`h-[5px] w-[18px] rounded-full ${
                      i < sessionsThisWeek ? "week-pip--filled" : "week-pip--empty"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                {sessionsThisWeek} of {weeklyGoal} sessions
              </p>
            </div>
          </div>
        </section>

        {firstAvailableLesson ? (
          <div className="mx-5 mt-4">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/learn/${encodeURIComponent(activeLanguage.language_code)}/lesson/${firstAvailableLesson.id}`
                )
              }
              className="flex w-full items-center justify-between rounded-full bg-[#BFFF00] px-6 py-4 font-extrabold text-[#2A3800]"
            >
              <span>Continue lesson</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10">
                →
              </span>
            </button>
          </div>
        ) : null}

        <section className="mx-5 mb-24 mt-8">
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
            Your {activeLanguage.language_name} path
          </h2>
          <div>
            {units.map((unit) => {
              const isLocked = unit.status === "locked";
              const isExpanded = !isLocked && expandedUnits.has(unit.id);
              const unitLessons = sortedLessons(lessonsByUnit[unit.id] ?? []);
              const note = unit.personalisation_note?.trim();

              return (
                <article
                  key={unit.id}
                  className="mb-3 overflow-hidden rounded-lg bg-[var(--card)]"
                >
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      if (isLocked) return;
                      setExpandedUnits((prev) => {
                        const next = new Set(prev);
                        if (next.has(unit.id)) next.delete(unit.id);
                        else next.add(unit.id);
                        return next;
                      });
                    }}
                    className={`flex w-full cursor-pointer items-center gap-3 p-4 text-left ${
                      isLocked ? "cursor-not-allowed opacity-80" : ""
                    }`}
                  >
                    {unit.status === "completed" ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--card-2)]">
                        <IconCheck size={16} className="text-[var(--text-secondary)]" stroke={2} />
                      </span>
                    ) : unit.status === "available" ? (
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--card-2)] text-sm font-extrabold text-[var(--accent)]"
                        aria-hidden
                      >
                        {unit.order_index + 1}
                      </span>
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--card-2)]">
                        <IconLock size={14} className="text-[var(--text-secondary)]" stroke={1.75} />
                      </span>
                    )}
                    <span
                      className={`min-w-0 flex-1 text-base font-bold ${
                        isLocked ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"
                      }`}
                    >
                      {unit.title}
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--card-2)] px-2 py-0.5 text-xs font-bold text-[var(--text-secondary)] uppercase">
                      {unit.cefr_level}
                    </span>
                    {!isLocked ? (
                      <IconChevronDown
                        size={18}
                        stroke={2}
                        className={`shrink-0 text-[var(--text-secondary)] transition-transform duration-300 ${
                          isExpanded ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    ) : null}
                  </button>

                  {!isLocked ? (
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isExpanded ? "max-h-[500px]" : "max-h-0"
                      }`}
                    >
                      {note ? (
                        <p className="px-4 pb-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                          {note}
                        </p>
                      ) : null}
                      <div className="border-t border-[var(--border)]">
                        {unitLessons.map((lesson) => {
                          const canOpen =
                            lesson.status === "available" || lesson.status === "completed";
                          const href = `/learn/${encodeURIComponent(activeLanguage.language_code)}/lesson/${lesson.id}`;
                          const rowClass =
                            "flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0";

                          const dotClass =
                            lesson.status === "completed"
                              ? "bg-[var(--text-secondary)]"
                              : lesson.status === "available"
                                ? "bg-[var(--text-secondary)]"
                                : "bg-[var(--card-2)]";

                          const lessonCtaClass =
                            "shrink-0 whitespace-nowrap rounded-full border border-[var(--accent)] px-3 py-1 text-[11px] font-bold text-[var(--accent)]";

                          if (canOpen) {
                            const isNextAvailable =
                              firstAvailableLesson != null && lesson.id === firstAvailableLesson.id;
                            return (
                              <Link key={lesson.id} href={href} className={rowClass}>
                                <LessonTypeIcon type={lesson.type} />
                                <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--text-primary)]">
                                  {lesson.title}
                                </span>
                                {lesson.status === "available" ? (
                                  <span className={lessonCtaClass}>
                                    {isNextAvailable ? "Start" : "Continue"}
                                  </span>
                                ) : (
                                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
                                )}
                              </Link>
                            );
                          }

                          return (
                            <div key={lesson.id} className={rowClass}>
                              <LessonTypeIcon type={lesson.type} />
                              <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--text-secondary)]">
                                {lesson.title}
                              </span>
                              <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-5 mt-2 mb-24">
          <Link
            href="/onboarding/4"
            className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-[var(--border)] p-4 text-center"
          >
            <IconPlus size={20} className="mb-1 text-[var(--text-secondary)]" stroke={1.75} />
            <span className="text-sm font-semibold text-[var(--text-secondary)]">Add another language</span>
          </Link>
        </section>
      </main>
      <BottomNav activeTab="learn" hasLearningLanguage />
    </>
  );
}
