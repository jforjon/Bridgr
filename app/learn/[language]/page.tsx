"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Circle,
  Lock,
  PenLine,
  Repeat2,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import BridgrPageLoading from "@/components/BridgrPageLoading";
import { createClient } from "@/lib/supabase/client";
import { SUPPORTED_LANGUAGES, type Course, type LearningLanguage, type Lesson, type Unit } from "@/types";

function resolveLanguageName(code: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  if (found) return found.name;
  if (code === "ca") return "Catalan";
  return code.length > 0 ? code.charAt(0).toUpperCase() + code.slice(1) : "Language";
}

function flagForCode(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.flag ?? "🌐";
}

const LESSON_ORDER: Lesson["type"][] = ["vocabulary", "grammar", "reading", "review"];

function lessonTypeLabel(type: Lesson["type"]): string {
  switch (type) {
    case "vocabulary":
      return "Vocabulary";
    case "grammar":
      return "Grammar";
    case "reading":
      return "Reading";
    case "review":
      return "Review";
    default:
      return type;
  }
}

function LessonTypeIcon({ type, className }: { type: Lesson["type"]; className?: string }) {
  const cn = className ?? "h-3.5 w-3.5";
  switch (type) {
    case "vocabulary":
      return <BookOpen className={cn} aria-hidden />;
    case "grammar":
      return <PenLine className={cn} aria-hidden />;
    case "reading":
      return <Sparkles className={cn} aria-hidden />;
    case "review":
      return <Repeat2 className={cn} aria-hidden />;
    default:
      return <BookOpen className={cn} aria-hidden />;
  }
}

function LessonStatusDot({ status }: { status: Lesson["status"] }) {
  if (status === "completed") {
    return <Check className="h-4 w-4 shrink-0 text-[#2D6A4F]" aria-hidden />;
  }
  if (status === "available") {
    return <Circle className="h-2.5 w-2.5 shrink-0 fill-[#2D6A4F] text-[#2D6A4F]" aria-hidden />;
  }
  return <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />;
}

function UnitStatusIcon({ status }: { status: Unit["status"] }) {
  if (status === "completed") {
    return <Check className="h-4 w-4 shrink-0 text-[#2D6A4F]" aria-hidden />;
  }
  if (status === "available") {
    return <Circle className="h-2.5 w-2.5 shrink-0 fill-[#2D6A4F] text-[#2D6A4F]" aria-hidden />;
  }
  return <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />;
}

export default function LearnLanguageCoursePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const languageCode =
    typeof params.language === "string" ? params.language.toLowerCase().trim() : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasLearningLanguage, setHasLearningLanguage] = useState(true);
  const [languageName, setLanguageName] = useState("");
  const [course, setCourse] = useState<Course | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessonsByUnit, setLessonsByUnit] = useState<Record<string, Lesson[]>>({});
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!languageCode) {
      setError("Missing language.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    const [{ data: learningRows }, { data: courseRow }] = await Promise.all([
      supabase.from("learning_languages").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase
        .from("courses")
        .select("*")
        .eq("user_id", user.id)
        .eq("language_code", languageCode)
        .maybeSingle()
    ]);

    const learningTyped = (learningRows ?? []) as LearningLanguage[];
    setHasLearningLanguage(learningTyped.length > 0);

    const learningForLang = learningTyped.find((l) => l.language_code === languageCode);
    setLanguageName(
      learningForLang?.language_name?.trim() || resolveLanguageName(languageCode)
    );

    if (!courseRow) {
      setLoading(false);
      router.replace(`/placement/${encodeURIComponent(languageCode)}`);
      return;
    }

    setCourse(courseRow as Course);

    const { data: unitRows, error: unitsError } = await supabase
      .from("units")
      .select("*")
      .eq("course_id", courseRow.id)
      .order("order_index", { ascending: true });

    if (unitsError) {
      setError(unitsError.message);
      setLoading(false);
      return;
    }

    const unitList = (unitRows ?? []) as Unit[];
    setUnits(unitList);

    const unitIds = unitList.map((u) => u.id);
    if (unitIds.length === 0) {
      setLessonsByUnit({});
      setExpandedUnitId(null);
      setLoading(false);
      return;
    }

    const { data: lessonRows, error: lessonsError } = await supabase
      .from("lessons")
      .select("*")
      .in("unit_id", unitIds)
      .order("order_index", { ascending: true });

    if (lessonsError) {
      setError(lessonsError.message);
      setLoading(false);
      return;
    }

    const grouped: Record<string, Lesson[]> = {};
    for (const id of unitIds) {
      grouped[id] = [];
    }
    for (const row of (lessonRows ?? []) as Lesson[]) {
      if (!grouped[row.unit_id]) grouped[row.unit_id] = [];
      grouped[row.unit_id].push(row);
    }
    for (const id of unitIds) {
      grouped[id].sort((a, b) => a.order_index - b.order_index);
    }
    setLessonsByUnit(grouped);

    const firstExpandable = unitList.find((u) => u.status === "available" || u.status === "completed");
    setExpandedUnitId(firstExpandable?.id ?? null);

    setLoading(false);
  }, [languageCode, router, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const flag = useMemo(() => flagForCode(languageCode), [languageCode]);

  const { currentUnitLabel, progressPct } = useMemo(() => {
    const total = units.length;
    if (total === 0) {
      return { currentUnitLabel: "Unit 0 of 0", progressPct: 0 };
    }
    const completed = units.filter((u) => u.status === "completed").length;
    const firstIncomplete = units.findIndex((u) => u.status !== "completed");
    const idx = firstIncomplete === -1 ? total - 1 : firstIncomplete;
    const displayNum = Math.min(idx + 1, total);
    const pct = total > 0 ? (completed / total) * 100 : 0;
    return {
      currentUnitLabel: `Unit ${displayNum} of ${total}`,
      progressPct: pct
    };
  }, [units]);

  const toggleUnit = (unit: Unit) => {
    if (unit.status === "locked") return;
    setExpandedUnitId((prev) => (prev === unit.id ? null : unit.id));
  };

  const lessonHref = (lesson: Lesson) =>
    `/learn/${encodeURIComponent(languageCode)}/lesson/${lesson.id}`;

  const goLesson = (lesson: Lesson) => {
    if (lesson.status !== "available") return;
    router.push(lessonHref(lesson));
  };

  const sortedLessonRows = (unitId: string): Lesson[] => {
    const list = lessonsByUnit[unitId] ?? [];
    const byType = new Map(list.map((l) => [l.type, l]));
    return LESSON_ORDER.map((t) => byType.get(t)).filter((l): l is Lesson => Boolean(l));
  };

  if (loading) {
    return (
      <BridgrPageLoading
        title="Loading your course…"
        subtitle="Fetching units and lessons"
        bottomSlot={<BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />}
      />
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#F8FAF9] px-5 pb-24 pt-8">
        <p className="text-center text-sm text-red-600">{error}</p>
        <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
      </main>
    );
  }

  if (!course) {
    return (
      <BridgrPageLoading
        title="Opening placement…"
        subtitle="We’ll set up your level for this language"
        bottomSlot={<BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAF9] pb-24">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-[#F8FAF9]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-lg leading-none" aria-hidden>
              {flag}
            </span>
            <span className="truncate font-medium text-[#0F1A14]">{languageName}</span>
          </div>
          <span className="shrink-0 rounded-full bg-[#E8F5EE] px-2.5 py-0.5 text-xs font-semibold text-[#2D6A4F]">
            {course.cefr_level}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-5">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="text-4xl leading-none" aria-hidden>
              {flag}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-2xl font-normal text-[#0F1A14]">{languageName}</h1>
              <p className="mt-2 inline-flex rounded-full bg-[#E8F5EE] px-3 py-1 text-xs font-semibold text-[#2D6A4F]">
                Level {course.cefr_level}
              </p>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{currentUnitLabel}</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#2D6A4F] transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {units.map((unit) => {
            const isLocked = unit.status === "locked";
            const isExpanded = expandedUnitId === unit.id && !isLocked;
            const lessonRows = sortedLessonRows(unit.id);

            return (
              <article
                key={unit.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm transition-opacity ${
                  isLocked ? "border-slate-100 opacity-60" : "border-slate-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleUnit(unit)}
                  disabled={isLocked}
                  className={`flex w-full items-start gap-3 text-left ${isLocked ? "cursor-not-allowed" : ""}`}
                >
                  <div className="mt-0.5 shrink-0">
                    <UnitStatusIcon status={unit.status} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium text-base text-[#0F1A14]">{unit.title}</h2>
                    {unit.description ? (
                      <p className="mt-1 text-sm text-slate-500">{unit.description}</p>
                    ) : null}
                    {unit.personalisation_note ? (
                      <p className="mt-2 text-xs italic text-amber-700/90">{unit.personalisation_note}</p>
                    ) : null}
                    {isLocked ? (
                      <p className="mt-3 text-xs text-slate-500">Complete previous unit to unlock</p>
                    ) : null}
                  </div>
                </button>

                {isExpanded && lessonRows.length > 0 ? (
                  <div className="mt-4 space-y-0 border-t border-slate-100 pt-3">
                    {lessonRows.map((lesson) => {
                      const canOpen = lesson.status === "available";
                      const isCompleted = lesson.status === "completed";
                      const href = lessonHref(lesson);

                      if (isCompleted) {
                        return (
                          <div
                            key={lesson.id}
                            className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left"
                          >
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                              <LessonTypeIcon type={lesson.type} className="h-3 w-3" />
                              {lessonTypeLabel(lesson.type)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-[#0F1A14]">{lesson.title}</span>
                            <Check className="h-4 w-4 shrink-0 text-[#2D6A4F]" aria-hidden />
                            <button
                              type="button"
                              onClick={() => router.push(href)}
                              className="shrink-0 cursor-pointer text-xs text-[#2D6A4F] underline"
                            >
                              Retake
                            </button>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          disabled={!canOpen}
                          onClick={() => goLesson(lesson)}
                          className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors ${
                            canOpen ? "hover:bg-slate-50 active:bg-slate-100" : "cursor-default opacity-80"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                            <LessonTypeIcon type={lesson.type} className="h-3 w-3" />
                            {lessonTypeLabel(lesson.type)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-[#0F1A14]">{lesson.title}</span>
                          <LessonStatusDot status={lesson.status} />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>

      <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
    </main>
  );
}
