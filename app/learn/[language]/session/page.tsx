"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BridgrPageLoading from "@/components/BridgrPageLoading";
import SessionDeck from "@/components/SessionDeck";
import { fetchSessionNext } from "@/lib/fetch-session-next";
import { createClient } from "@/lib/supabase/client";
import { SUPPORTED_LANGUAGES, type SessionCard } from "@/types";

export default function LearnSessionPage() {
  const params = useParams();
  const router = useRouter();
  const urlLanguageCode =
    typeof params.language === "string" ? params.language.toLowerCase().trim() : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cards, setCards] = useState<SessionCard[]>([]);
  const [resolvedLanguageCode, setResolvedLanguageCode] = useState("");
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [lessonExhausted, setLessonExhausted] = useState(false);

  const languageName = useMemo(() => {
    const code = resolvedLanguageCode || urlLanguageCode;
    const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    if (found) return found.name;
    if (!code) return "Language";
    return code.charAt(0).toUpperCase() + code.slice(1);
  }, [resolvedLanguageCode, urlLanguageCode]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");
      setCards([]);

      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      let languageCode = urlLanguageCode;

      if (urlLanguageCode) {
        const { data: course } = await supabase
          .from("courses")
          .select("language_code")
          .eq("language_code", urlLanguageCode)
          .maybeSingle();

        if (course?.language_code) {
          languageCode = String(course.language_code).toLowerCase().trim();
        }
      }

      if (!languageCode) {
        const { data: courses } = await supabase.from("courses").select("language_code").limit(1);
        const fallback = courses?.[0]?.language_code;
        if (typeof fallback === "string" && fallback.trim()) {
          languageCode = fallback.toLowerCase().trim();
        }
      }

      if (!languageCode) {
        if (!cancelled) {
          setError("Missing language.");
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setResolvedLanguageCode(languageCode);
      }

      const { ok, status, data } = await fetchSessionNext(languageCode);

      if (cancelled) return;

      if (!ok) {
        if (status === 401) {
          router.replace("/login");
          return;
        }
        setError(data.error ?? "Could not load session.");
        setCards([]);
        setLoading(false);
        return;
      }

      setCards(Array.isArray(data.cards) ? data.cards : []);
      setLessonId(typeof data.lesson_id === "string" ? data.lesson_id : null);
      setUnitId(typeof data.unit_id === "string" ? data.unit_id : null);
      setLessonExhausted(data.lesson_exhausted === true);
      setLoading(false);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [urlLanguageCode, router]);

  if (loading) {
    return <BridgrPageLoading />;
  }

  if (error) {
    return (
      <main className="px-page flex min-h-screen flex-col items-center justify-center bg-app text-center">
        <p className="text-base font-semibold text-ink">We couldn&apos;t load this session</p>
        <p className="mt-2 max-w-xs text-sm text-ink-secondary">{error}</p>
        <button
          type="button"
          className="btn-primary mt-6 px-6 py-3 text-sm"
          onClick={() => router.push("/learn")}
        >
          Back to home
        </button>
      </main>
    );
  }

  return (
    <SessionDeck
      cards={cards}
      languageCode={resolvedLanguageCode || urlLanguageCode}
      languageName={languageName}
      lessonId={lessonId}
      unitId={unitId}
      lessonExhausted={lessonExhausted}
    />
  );
}
