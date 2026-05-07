"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type IntroRememberEntry =
  | { status: "loading" }
  | { status: "ok"; paragraph: string }
  | { status: "empty" }
  | { status: "error"; message: string };

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
  const [introRememberByWordId, setIntroRememberByWordId] = useState<
    Record<string, IntroRememberEntry>
  >({});

  const [completeSaving, setCompleteSaving] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const backHref = `/learn/${encodeURIComponent(languageCode)}`;

  useEffect(() => {
    setLessonPhase(null);
    setIntroIndex(0);
    setIntroRememberByWordId({});
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
      setIntroRememberByWordId({});
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
    } catch {
      setVocabError("Network error while loading vocabulary.");
      setVocabItems([]);
    } finally {
      setVocabLoading(false);
    }
  }, [lessonId, languageCode]);

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

  useEffect(() => {
    if (lessonPhase !== "intro" || vocabItems.length === 0) return;

    const knownMapped = knownLanguageRows
      .filter((k) => !k.is_reference_only)
      .map((k) => ({
        language: k.language_name,
        code: k.language_code,
        cefr_level: k.proficiency
      }));

    let cancelled = false;

    void (async () => {
      const loadingMap: Record<string, IntroRememberEntry> = {};
      for (const item of vocabItems) {
        loadingMap[item.word_id] = { status: "loading" };
      }
      if (!cancelled) setIntroRememberByWordId((prev) => ({ ...prev, ...loadingMap }));

      const updates = await Promise.all(
        vocabItems.map(async (item): Promise<[string, IntroRememberEntry]> => {
          const translation = (item.translation_en ?? item.translation).trim();
          try {
            const res = await fetch("/api/understand", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                word_id: item.word_id,
                word: item.word,
                language_code: targetLang,
                translation,
                known_languages: knownMapped
              })
            });
            const data = (await res.json().catch(() => ({}))) as {
              hook?: string;
              error?: string;
            };
            if (!res.ok) {
              return [
                item.word_id,
                { status: "error", message: data.error ?? "Could not load memory hook" }
              ];
            }
            const hook = (data.hook ?? "").trim();
            if (!hook) {
              return [item.word_id, { status: "empty" } as IntroRememberEntry];
            }
            return [item.word_id, { status: "ok", paragraph: hook } as IntroRememberEntry];
          } catch {
            return [item.word_id, { status: "error", message: "Network error" }];
          }
        })
      );

      if (cancelled) return;
      setIntroRememberByWordId((prev) => {
        const next = { ...prev };
        for (const [id, entry] of updates) {
          next[id] = entry;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [lessonPhase, vocabItems, knownLanguageRows, targetLang]);

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
  const introRemember = introItem ? introRememberByWordId[introItem.word_id] : undefined;
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
      <main className="min-h-screen bg-[#F8FAF9] px-5 pb-24 pt-8">
        <p className="text-center text-sm text-slate-600">Lesson not found.</p>
        <div className="mt-6 text-center">
          <Link href={backHref} className="text-sm font-medium text-[#2D6A4F]">
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
      <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <p className="font-serif text-xl text-[#0F1A14]">Coming soon</p>
        <p className="mt-2 text-sm text-slate-600">
          This lesson type is not available yet. Check back later.
        </p>
        <Link
          href={backHref}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-[#0F1A14] hover:bg-slate-50"
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
      <main className="min-h-screen bg-[#F8FAF9] pb-36">
        <p className="px-6 pt-8 font-serif text-xl text-[#2D6A4F]">Bridgr</p>
        <h1 className="mt-12 px-6 font-serif text-3xl text-[#0F1A14]">You just learned</h1>
        <p className="mt-2 px-6 text-base text-slate-500">
          {totalWords} new {totalWords === 1 ? "word" : "words"} in {targetLanguageName}
        </p>

        <div className="mt-8 px-6">
          {vocabItems.map((item) => (
            <div
              key={item.word_id}
              className="mb-3 flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-5 py-4"
            >
              <p className="font-serif text-xl text-[#0F1A14]">{item.word}</p>
              <p className="text-base text-slate-500">{(item.translation_en ?? item.translation).trim()}</p>
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-[#F8FAF9] px-6 pb-8 pt-4">
          {completeError ? (
            <p className="mb-3 text-center text-sm text-red-600">{completeError}</p>
          ) : null}
          <button
            type="button"
            disabled={completeSaving}
            className="w-full rounded-2xl bg-[#2D6A4F] py-4 font-semibold text-white disabled:opacity-50"
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
            className="mt-3 w-full text-center text-sm text-slate-400 underline disabled:opacity-50"
            onClick={() => {
              void (async () => {
                setCompleteSaving(true);
                setCompleteError("");
                try {
                  await completeLessonApi();
                  router.push("/dashboard");
                } catch (e) {
                  setCompleteError(e instanceof Error ? e.message : "Could not save lesson progress.");
                } finally {
                  setCompleteSaving(false);
                }
              })();
            }}
          >
            Go to dashboard
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
        exitLabel="Exit"
        hideBottomNav
        lessonId={lessonId}
        onSessionComplete={onSessionComplete}
        showLessonCompletionScreen
        onLessonDeckFinished={onLessonDeckFinished}
      />
    );
  }

  if (deckReady && lessonPhase === "transition") {
    return (
      <main className="flex min-h-screen flex-col bg-[#F8FAF9] pb-24">
        <header className="sticky top-0 z-30 border-b border-slate-100 bg-[#F8FAF9]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <Link
              href={backHref}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Back to course"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">vocabulary</p>
              <h1 className="truncate font-serif text-lg text-[#0F1A14]">{lesson.title}</h1>
            </div>
            {process.env.NODE_ENV === "development" ? (
              <button
                type="button"
                onClick={() => setLessonPhase("complete")}
                className="shrink-0 text-xs text-slate-300 underline"
              >
                skip
              </button>
            ) : null}
          </div>
        </header>
        <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="font-serif text-2xl text-[#0F1A14]">Now let&apos;s practise</p>
          <p className="mt-4 text-sm text-slate-500">Try to recall each word from memory</p>
          <button
            type="button"
            onClick={() => {
              setLessonPhase("practice");
            }}
            className="mt-10 w-full max-w-sm rounded-2xl bg-[#2D6A4F] py-4 text-base font-semibold text-white"
          >
            Start practice
          </button>
        </div>
      </main>
    );
  }

  if (deckReady && lessonPhase === "intro" && introItem) {
    return (
      <main className="min-h-screen bg-[#F8FAF9] pb-32">
        <div className="fixed inset-x-0 top-0 z-40 bg-white">
          <div className="mx-auto max-w-2xl border-b border-slate-100 px-4 py-3">
            <div className="grid grid-cols-3 items-center">
              <div className="flex items-center gap-2">
                <Link href={backHref} className="text-sm font-medium text-slate-600">
                  Exit
                </Link>
                {process.env.NODE_ENV === "development" ? (
                  <button
                    type="button"
                    onClick={() => setLessonPhase("complete")}
                    className="text-xs text-slate-300 underline"
                  >
                    skip
                  </button>
                ) : null}
              </div>
              <p className="text-center text-sm text-slate-600">
                Word {introIndex + 1} of {vocabItems.length}
              </p>
              <div />
            </div>
            <div className="mt-3 h-1 w-full bg-slate-100">
              <div className="h-full bg-[#2D6A4F]" style={{ width: `${introProgressPct}%` }} />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 pt-24">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
            <p className="text-center font-serif text-5xl font-normal text-[#0F1A14]">{introItem.word}</p>
            <p className="mt-4 text-center text-2xl text-slate-600">
              {(introItem.translation_en ?? introItem.translation).trim()}
            </p>
            {introItem.part_of_speech?.trim() ? (
              <div className="mt-5 flex justify-center">
                <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {introItem.part_of_speech}
                </p>
              </div>
            ) : null}

            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="mb-2 text-xs uppercase tracking-widest text-amber-600">REMEMBER IT</p>
              {!introRemember || introRemember.status === "loading" ? (
                <div className="space-y-2" aria-busy>
                  <div className="h-3 w-[85%] max-w-md animate-pulse rounded bg-amber-100/80" />
                  <div className="h-3 w-full animate-pulse rounded bg-amber-100/80" />
                  <div className="h-3 w-[70%] max-w-sm animate-pulse rounded bg-amber-100/80" />
                </div>
              ) : introRemember.status === "ok" ? (
                <p className="text-sm leading-relaxed text-amber-950">{introRemember.paragraph}</p>
              ) : introRemember.status === "error" ? (
                <p className="text-sm text-amber-900">{introRemember.message}</p>
              ) : (
                <p className="text-sm text-amber-900">No memory hook for this word yet.</p>
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
              className="mt-10 w-full rounded-2xl bg-[#2D6A4F] py-4 text-base font-semibold text-white"
            >
              Next
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAF9] pb-24">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-[#F8FAF9]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            href={backHref}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Back to course"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{lesson.type}</p>
            <h1 className="truncate font-serif text-lg text-[#0F1A14]">{lesson.title}</h1>
          </div>
        </div>
      </header>

      {lesson.type === "grammar" ? comingSoon : null}

      {lesson.type === "vocabulary" ? (
        <>
          {vocabError ? (
            <div className="mx-auto max-w-lg px-5 py-8 text-center">
              <p className="text-sm text-red-600">{vocabError}</p>
              <button
                type="button"
                onClick={() => void loadVocabBank()}
                className="mt-4 rounded-2xl bg-[#2D6A4F] px-5 py-2 text-sm font-semibold text-white"
              >
                Try again
              </button>
            </div>
          ) : deckReady && lessonPhase === null ? (
            <div className="mx-auto max-w-lg px-5 py-16 text-center">
              <div
                className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#2D6A4F]"
                aria-hidden
              />
              <p className="mt-4 text-sm text-slate-600">Preparing introduction…</p>
            </div>
          ) : (
            <div className="mx-auto max-w-lg px-5 py-8 text-center text-sm text-slate-600">
              No vocabulary for this lesson yet.
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}
