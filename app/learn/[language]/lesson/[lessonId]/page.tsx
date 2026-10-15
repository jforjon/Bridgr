"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import BridgrPageLoading from "@/components/BridgrPageLoading";
import SessionDeck from "@/components/SessionDeck";
import { fetchSessionNext } from "@/lib/fetch-session-next";
import { createClient } from "@/lib/supabase/client";
import { SUPPORTED_LANGUAGES, type Lesson, type SessionCard } from "@/types";

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type LessonWithUnit = Lesson & {
  units: {
    id: string;
    topic_key: string;
    cefr_level: string;
    course_id: string;
    courses: { user_id: string; language_code: string };
  };
};

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const routeLanguageCode =
    typeof params.language === "string" ? params.language.toLowerCase().trim() : "";
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : "";

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [courseLanguage, setCourseLanguage] = useState("");

  const [sessionCards, setSessionCards] = useState<SessionCard[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [sessionLessonId, setSessionLessonId] = useState<string | null>(null);
  const [sessionUnitId, setSessionUnitId] = useState<string | null>(null);
  const [sessionLessonExhausted, setSessionLessonExhausted] = useState(false);

  const backHref = "/learn";

  const loadSession = useCallback(async (languageCode: string) => {
    const lang = languageCode.toLowerCase().trim();
    if (!lang) {
      setSessionError("Missing language for this lesson.");
      return;
    }

    setSessionLoading(true);
    setSessionError("");

    const { ok, status, data, requestUrl } = await fetchSessionNext(lang);
    console.log("[lesson] session/next request:", requestUrl);
    console.log("[lesson] session/next response:", data);

    if (!ok) {
      setSessionError(data.error ?? "Could not load session.");
      setSessionCards([]);
      setSessionLoading(false);
      return;
    }

    setSessionCards(Array.isArray(data.cards) ? data.cards : []);
    setSessionLessonId(typeof data.lesson_id === "string" ? data.lesson_id : null);
    setSessionUnitId(typeof data.unit_id === "string" ? data.unit_id : null);
    setSessionLessonExhausted(data.lesson_exhausted === true);
    setSessionLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!lessonId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setLesson(null);
      setCourseLanguage("");
      setSessionCards([]);
      setSessionError("");
      setSessionLoading(false);
      setSessionLessonId(null);
      setSessionUnitId(null);
      setSessionLessonExhausted(false);

      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: lessonRow, error } = await supabase
        .from("lessons")
        .select(
          `
          id,
          unit_id,
          type,
          title,
          order_index,
          status,
          content,
          completed_at,
          units!inner (
            id,
            topic_key,
            cefr_level,
            course_id,
            courses!inner ( user_id, language_code )
          )
        `
        )
        .eq("id", lessonId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !lessonRow) {
        setLesson(null);
        setLoading(false);
        return;
      }

      const raw = lessonRow as unknown as LessonWithUnit;
      const unit = unwrapOne(raw.units);
      const course = unit ? unwrapOne(unit.courses) : null;

      if (!unit || !course || course.user_id !== user.id) {
        setLesson(null);
        setLoading(false);
        return;
      }

      const languageCode = String(course.language_code).toLowerCase().trim();
      setCourseLanguage(languageCode);

      const { units: _u, ...lessonOnly } = raw;
      setLesson(lessonOnly as Lesson);
      setLoading(false);

      if (lessonOnly.type === "reading" && lessonOnly.status !== "completed") {
        router.replace("/learn/reading");
        return;
      }
      if (lessonOnly.type === "review" && lessonOnly.status !== "completed") {
        router.replace("/review");
        return;
      }
      if (lessonOnly.type === "vocabulary") {
        await loadSession(languageCode);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [lessonId, loadSession, router, supabase]);

  const targetLang = courseLanguage || routeLanguageCode;
  const targetLanguageName = useMemo(() => {
    const found = SUPPORTED_LANGUAGES.find((entry) => entry.code === targetLang);
    if (found) return found.name;
    if (!targetLang) return "this language";
    return targetLang.charAt(0).toUpperCase() + targetLang.slice(1);
  }, [targetLang]);

  if (loading || (lesson?.type === "vocabulary" && sessionLoading)) {
    return <BridgrPageLoading subtitle="Loading your session…" />;
  }

  if (!lesson) {
    return (
      <main className="px-page min-h-screen bg-[var(--bg)] pb-24 pt-8">
        <p className="text-center text-sm text-[var(--text-2)]">Lesson not found.</p>
        <div className="mt-6 text-center">
          <Link href={backHref} className="text-sm font-semibold text-[var(--accent-text)]">
            Back to course
          </Link>
        </div>
      </main>
    );
  }

  if (
    (lesson.type === "reading" || lesson.type === "review") &&
    lesson.status !== "completed"
  ) {
    return (
      <BridgrPageLoading
        title="Redirecting…"
        subtitle={
          lesson.type === "reading" ? "Opening reading practice" : "Opening your review session"
        }
      />
    );
  }

  if (lesson.type === "vocabulary") {
    if (sessionError) {
      return (
        <main className="px-page flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] text-center">
          <p className="text-sm text-danger">{sessionError}</p>
          <button
            type="button"
            className="btn-primary mt-6"
            onClick={() => void loadSession(targetLang)}
          >
            Try again
          </button>
          <Link
            href={backHref}
            className="mt-4 text-sm font-semibold text-[var(--accent-text)]"
          >
            Back to course
          </Link>
        </main>
      );
    }

    return (
      <SessionDeck
        key={`${lessonId}-session-${targetLang}`}
        cards={sessionCards}
        languageCode={targetLang}
        languageName={targetLanguageName}
        lessonId={sessionLessonId}
        unitId={sessionUnitId}
        lessonExhausted={sessionLessonExhausted}
      />
    );
  }

  const comingSoon = (
    <div className="px-page mx-auto max-w-lg py-8">
      <div className="rounded-xl bg-[var(--surface-1)] p-8 text-center">
        <p className="font-sans text-xl font-semibold text-[var(--text-1)]">Coming soon</p>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          This lesson type is not available yet. Check back later.
        </p>
        <Link
          href={backHref}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to course
        </Link>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[var(--bg)] pb-24">
      <header className="px-page sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/95 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            href={backHref}
            className="rounded-lg p-2 text-[var(--text-2)] hover:bg-[var(--surface-1)]"
            aria-label="Back to course"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)]">
              {lesson.type}
            </p>
            <h1 className="truncate font-sans text-lg font-semibold text-[var(--text-1)]">
              {lesson.title}
            </h1>
          </div>
        </div>
      </header>

      {lesson.type === "grammar" ? comingSoon : null}
    </main>
  );
}
