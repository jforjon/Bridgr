"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import BridgrPageLoading from "@/components/BridgrPageLoading";
import VocabularyTypingDeck, {
  type VocabDeckItem
} from "@/components/VocabularyTypingDeck";
import { createClient } from "@/lib/supabase/client";
import { SUPPORTED_LANGUAGES, type KnownLanguage, type Lesson } from "@/types";

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

type LessonPhase = "intro" | "transition" | "practice" | "complete" | null;

type LessonMemoryHook = {
  hook: string;
  type: string;
  source_language: string;
};

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const languageCode =
    typeof params.language === "string" ? params.language.toLowerCase().trim() : "";
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : "";

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [courseLanguage, setCourseLanguage] = useState<string>("");
  const [knownLanguageRows, setKnownLanguageRows] = useState<KnownLanguage[]>([]);
  const [vocabItems, setVocabItems] = useState<VocabDeckItem[]>([]);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [vocabError, setVocabError] = useState("");

  const [lessonPhase, setLessonPhase] = useState<LessonPhase>(null);
  const [introIndex, setIntroIndex] = useState(0);
  const [hooks, setHooks] = useState<Record<string, LessonMemoryHook>>({});
  const [hooksPrefetchDone, setHooksPrefetchDone] = useState(false);

  const [completeSaving, setCompleteSaving] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const backHref = "/learn";

  useEffect(() => {
    setLessonPhase(null);
    setIntroIndex(0);
    setHooks({});
    setHooksPrefetchDone(false);
    setCompleteError("");
    setVocabItems([]);
    setVocabError("");
  }, [lessonId]);

  useEffect(() => {
    const run = async () => {
      if (!lessonId || !languageCode) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setLessonPhase(null);
      setIntroIndex(0);
      setHooks({});
      setHooksPrefetchDone(false);
      setCompleteError("");
      setVocabItems([]);
      setVocabError("");

      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const [{ data: knownRows }, { data: lessonRow, error }] = await Promise.all([
          supabase.from("known_languages").select("*").eq("user_id", user.id),
          supabase
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
            .maybeSingle()
        ]);

      setKnownLanguageRows((knownRows ?? []) as KnownLanguage[]);

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

      const lc = course.language_code.toLowerCase();
      setCourseLanguage(lc);
      if (lc !== languageCode) {
        setLesson(null);
        setLoading(false);
        return;
      }

      const { units: _u, ...lessonOnly } = raw;
      setLesson(lessonOnly as Lesson);

      if (lessonOnly.type === "reading") {
        setVocabLoading(false);
        setLoading(false);
        if (lessonOnly.status !== "completed") {
          router.replace("/learn/reading");
          return;
        }
        return;
      }
      if (lessonOnly.type === "review") {
        setVocabLoading(false);
        setLoading(false);
        if (lessonOnly.status !== "completed") {
          router.replace("/review");
          return;
        }
        return;
      }

      if (lessonOnly.type === "vocabulary") {
        setVocabLoading(true);
      } else {
        setVocabLoading(false);
      }

      setLoading(false);
    };
    void run();
  }, [languageCode, lessonId, router, supabase]);

  const fetchAllHooks = useCallback(
    (words: VocabDeckItem[]) => {
      if (words.length === 0) return;
      setHooksPrefetchDone(false);
      setHooks({});
      const knownMapped = knownLanguageRows
        .filter((k) => !k.is_reference_only)
        .map((k) => ({
          language: k.language_name,
          code: k.language_code,
          cefr_level: k.proficiency
        }));
      const lang = (courseLanguage || languageCode).toLowerCase();

      void Promise.all(
        words.map(async (word) => {
          try {
            const res = await fetch("/api/understand", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                word_id: word.word_id,
                word: word.word,
                language_code: lang,
                translation: (word.translation_en ?? word.translation).trim(),
                known_languages: knownMapped
              })
            });
            const data = (await res.json().catch(() => ({}))) as {
              hook?: string;
              type?: string;
              source_language?: string;
              error?: string;
            };
            if (!res.ok) return;
            const hook = (data.hook ?? "").trim();
            if (!hook) return;
            setHooks((prev) => ({
              ...prev,
              [word.word_id]: {
                hook,
                type: typeof data.type === "string" ? data.type : "",
                source_language: typeof data.source_language === "string" ? data.source_language : ""
              }
            }));
          } catch {
            /* skip */
          }
        })
      ).finally(() => {
        setHooksPrefetchDone(true);
      });
    },
    [knownLanguageRows, courseLanguage, languageCode]
  );

  const loadVocabBank = useCallback(async () => {
    if (!lessonId) return;
    setVocabLoading(true);
    setVocabError("");
    try {
      const res = await fetch("/api/lesson/vocabulary-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lesson_id: lessonId })
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: VocabDeckItem[];
        error?: string;
      };
      if (!res.ok) {
        setVocabError(data.error ?? "Could not load vocabulary.");
        setVocabItems([]);
        return;
      }
      const items = data.items ?? [];
      const lc = languageCode;
      const enriched = await Promise.all(
        items.map(async (item) => {
          if (item.flashcard_id) return item;
          const ur = await fetch("/api/flashcards/upsert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              word_id: item.word_id,
              lesson_id: lessonId,
              language_code: lc
            })
          });
          const ud = (await ur.json().catch(() => ({}))) as { id?: string; error?: string };
          if (!ur.ok || !ud.id) {
            console.error("[lesson] /api/flashcards/upsert failed:", ud.error ?? ur.status);
            return item;
          }
          return { ...item, flashcard_id: ud.id };
        })
      );
      setVocabItems(enriched);
      if (enriched.length > 0) {
        fetchAllHooks(enriched);
      }
    } catch {
      setVocabError("Network error while loading vocabulary.");
      setVocabItems([]);
    } finally {
      setVocabLoading(false);
    }
  }, [lessonId, languageCode, fetchAllHooks]);

  useEffect(() => {
    if (!lesson || lesson.type !== "vocabulary") return;
    void loadVocabBank();
  }, [lesson, loadVocabBank]);

  useEffect(() => {
    if (vocabError) {
      setLessonPhase(null);
      setIntroIndex(0);
    }
  }, [vocabError]);

  useEffect(() => {
    if (lesson?.type !== "vocabulary" || vocabItems.length === 0 || vocabError) return;
    setLessonPhase((p) => (p === null ? "intro" : p));
  }, [lesson?.type, vocabItems.length, vocabError]);

  const targetLang = courseLanguage || languageCode;

  const vocabFetchBlocking =
    lesson?.type === "vocabulary" && vocabLoading && !vocabError;

  const completeLessonApi = useCallback(async () => {
    const res = await fetch("/api/lesson/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ lesson_id: lessonId })
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Could not save lesson progress.");
    }
    await fetch("/api/streak/session", {
      method: "POST",
      credentials: "include"
    });
  }, [lessonId]);

  const onSessionComplete = useCallback(async () => {
    await completeLessonApi();
    router.replace(backHref);
  }, [completeLessonApi, router, backHref]);

  const onLessonDeckFinished = useCallback(() => {
    setLessonPhase("complete");
  }, []);

  const introItem = useMemo(
    () => (vocabItems.length > 0 ? vocabItems[introIndex] ?? null : null),
    [vocabItems, introIndex]
  );
  const introHookParagraph = introItem ? (hooks[introItem.word_id]?.hook ?? "").trim() : "";
  const introProgressPct =
    vocabItems.length > 0 ? ((introIndex + 1) / vocabItems.length) * 100 : 0;
  const targetLanguageName =
    SUPPORTED_LANGUAGES.find((entry) => entry.code === targetLang)?.name ??
    (targetLang ? targetLang.charAt(0).toUpperCase() + targetLang.slice(1) : "this language");

  if (loading || vocabFetchBlocking) {
    return <BridgrPageLoading />;
  }

  if (!lesson) {
    return (
      <main className="min-h-screen bg-teal-900 px-5 pb-24 pt-8">
        <p className="text-center text-sm text-teal-200">Lesson not found.</p>
        <div className="mt-6 text-center">
          <Link href={backHref} className="text-sm font-extrabold text-lime-300">
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

  const comingSoon = (
    <div className="mx-auto max-w-lg px-5 py-8">
      <div className="rounded-xl border border-teal-400/30 bg-teal-800 p-8 text-center">
        <p className="font-sans text-xl font-extrabold text-white">Coming soon</p>
        <p className="mt-2 text-sm text-teal-200">
          This lesson type is not available yet. Check back later.
        </p>
        <Link
          href={backHref}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-teal-400/30 px-5 py-3 text-sm font-extrabold text-teal-200 hover:bg-teal-850"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to course
        </Link>
      </div>
    </div>
  );

  const deckReady = lesson.type === "vocabulary" && vocabItems.length > 0;
  const totalWords = vocabItems.length;

  if (deckReady && lessonPhase === "complete") {
    return (
      <main className="min-h-screen bg-teal-900 pb-36">
        <p className="px-6 pt-8 font-sans text-xl font-extrabold text-lime-300">Bridgr</p>
        <h1 className="mt-12 px-6 font-sans text-3xl font-extrabold text-white">You just learned</h1>
        <p className="mt-2 px-6 text-base text-teal-200">
          {totalWords} new {totalWords === 1 ? "word" : "words"} in {targetLanguageName}
        </p>

        <div className="mt-8 px-6">
          {vocabItems.map((item) => (
            <div
              key={item.word_id}
              className="mb-3 flex items-center justify-between rounded-xl border border-teal-400/30 bg-teal-800 px-5 py-4"
            >
              <p className="font-sans text-xl font-extrabold text-white">{item.word}</p>
              <p className="text-base text-teal-200">{(item.translation_en ?? item.translation).trim()}</p>
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 border-t border-teal-700/50 bg-teal-900 px-6 pb-8 pt-4">
          {completeError ? (
            <p className="mb-3 text-center text-sm text-red-400">{completeError}</p>
          ) : null}
          <button
            type="button"
            disabled={completeSaving}
            className="w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700 disabled:opacity-50"
            onClick={() => {
              void (async () => {
                setCompleteSaving(true);
                setCompleteError("");
                try {
                  await completeLessonApi();
                  router.replace(backHref);
                } catch (e) {
                  setCompleteError(e instanceof Error ? e.message : "Could not save lesson progress.");
                } finally {
                  setCompleteSaving(false);
                }
              })();
            }}
          >
            {completeSaving ? "Saving…" : "Back to my course"}
          </button>
          <button
            type="button"
            disabled={completeSaving}
            className="mt-3 w-full text-center text-sm font-bold text-teal-300 underline disabled:opacity-50"
            onClick={() => {
              void (async () => {
                setCompleteSaving(true);
                setCompleteError("");
                try {
                  await completeLessonApi();
                  router.push("/learn");
                } catch (e) {
                  setCompleteError(e instanceof Error ? e.message : "Could not save lesson progress.");
                } finally {
                  setCompleteSaving(false);
                }
              })();
            }}
          >
            Go to home
          </button>
        </div>
      </main>
    );
  }

  if (deckReady && lessonPhase === "practice") {
    return (
      <VocabularyTypingDeck
        key={`${lessonId}-practice`}
        items={vocabItems}
        languageCode={targetLang}
        knownLanguageRows={knownLanguageRows}
        exitHref={backHref}
        exitLabel="Close"
        hideBottomNav
        lessonId={lessonId}
        onSessionComplete={onSessionComplete}
        showLessonCompletionScreen
        onLessonDeckFinished={onLessonDeckFinished}
        prefetchedMemoryHooks={hooks}
      />
    );
  }

  if (deckReady && lessonPhase === "transition") {
    return (
      <main className="flex min-h-screen flex-col bg-teal-900 pb-24">
        <header className="sticky top-0 z-30 border-b border-teal-700/50 bg-teal-900/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <Link
              href={backHref}
              className="rounded-lg p-2 text-teal-200 hover:bg-teal-800"
              aria-label="Back to course"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-300">vocabulary</p>
              <h1 className="truncate font-sans text-lg font-extrabold text-white">{lesson.title}</h1>
            </div>
            {process.env.NODE_ENV === "development" ? (
              <button
                type="button"
                onClick={() => setLessonPhase("complete")}
                className="shrink-0 text-xs text-teal-400 underline"
              >
                skip
              </button>
            ) : null}
          </div>
        </header>
        <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="font-sans text-2xl font-extrabold text-white">Now let&apos;s practise</p>
          <p className="mt-4 text-sm text-teal-200">Try to recall each word from memory</p>
          <button
            type="button"
            onClick={() => {
              setLessonPhase("practice");
            }}
            className="mt-10 w-full max-w-sm rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700"
          >
            Start practice
          </button>
        </div>
      </main>
    );
  }

  if (deckReady && lessonPhase === "intro" && introItem) {
    return (
      <main className="min-h-screen bg-teal-900 pb-32">
        <div className="fixed inset-x-0 top-0 z-40 bg-teal-900">
          <div className="mx-auto max-w-2xl border-b border-teal-700/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <Link
                href={backHref}
                aria-label="Close"
                className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#1a3d38] text-[#8fbfb8] transition hover:opacity-90"
              >
                <IconX size={18} stroke={1.75} />
              </Link>
              <p className="text-center text-[13px] font-bold text-[#8fbfb8]">
                {`${introIndex + 1} / ${vocabItems.length}`}
              </p>
              <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-end">
                {process.env.NODE_ENV === "development" ? (
                  <button
                    type="button"
                    onClick={() => setLessonPhase("complete")}
                    className="border-0 bg-transparent p-0 text-xs text-teal-400 underline"
                  >
                    skip
                  </button>
                ) : (
                  <span className="block w-full" aria-hidden />
                )}
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-teal-700">
              <div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${introProgressPct}%` }} />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 pt-24">
          <div className="rounded-xl border border-teal-400/30 bg-teal-800 p-8 text-center">
            <p className="text-center font-sans text-5xl font-extrabold text-white">{introItem.word}</p>
            <p className="mt-4 text-center text-2xl text-teal-200">
              {(introItem.translation_en ?? introItem.translation).trim()}
            </p>
            {introItem.part_of_speech?.trim() ? (
              <div className="mt-5 flex justify-center">
                <p className="inline-flex rounded-full border border-teal-400/30 bg-teal-850 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-200">
                  {introItem.part_of_speech}
                </p>
              </div>
            ) : null}

            <div className="mt-8 rounded-[12px] bg-[rgba(127,255,95,0.1)] px-4 py-[14px] text-left text-[14px] font-semibold text-lime-300">
              <span aria-hidden>💡 </span>
              {introHookParagraph ? (
                <span className="whitespace-pre-wrap">{introHookParagraph}</span>
              ) : !hooksPrefetchDone ? (
                <span className="text-lime-300/80">Loading tip…</span>
              ) : (
                <span className="text-lime-300/90">No memory hook for this word yet.</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (introIndex >= vocabItems.length - 1) {
                  setLessonPhase("transition");
                } else {
                  setIntroIndex((i) => i + 1);
                }
              }}
              className="mt-10 w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700"
            >
              Next
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-teal-900 pb-24">
      <header className="sticky top-0 z-30 border-b border-teal-700/50 bg-teal-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            href={backHref}
            className="rounded-lg p-2 text-teal-200 hover:bg-teal-800"
            aria-label="Back to course"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-300">{lesson.type}</p>
            <h1 className="truncate font-sans text-lg font-extrabold text-white">{lesson.title}</h1>
          </div>
        </div>
      </header>

      {lesson.type === "grammar" ? comingSoon : null}

      {lesson.type === "vocabulary" ? (
        <>
          {vocabError ? (
            <div className="mx-auto max-w-lg px-5 py-8 text-center">
              <p className="text-sm text-red-400">{vocabError}</p>
              <button
                type="button"
                onClick={() => void loadVocabBank()}
                className="mt-4 rounded-full bg-lime-300 px-5 py-2 text-sm font-extrabold text-lime-700"
              >
                Try again
              </button>
            </div>
          ) : deckReady && lessonPhase === null ? (
            <div className="mx-auto max-w-lg px-5 py-16 text-center">
              <div
                className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-lime-300"
                aria-hidden
              />
              <p className="mt-4 text-sm text-teal-200">Preparing introduction…</p>
            </div>
          ) : (
            <div className="mx-auto max-w-lg px-5 py-8 text-center text-sm text-teal-200">
              No vocabulary for this lesson yet.
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}
