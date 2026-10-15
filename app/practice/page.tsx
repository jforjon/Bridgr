"use client";

import Link from "next/link";
import {
  IconCards,
  IconChevronRight,
  IconFileText,
  IconHeadphones,
  IconMessages
} from "@tabler/icons-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { createClient } from "@/lib/supabase/client";
import type { LearningLanguage } from "@/types";

type PracticeMode = "smart" | "topic";

type TopicItem = {
  topic_key: string;
  topic_name: string;
};

function PracticeSkeleton() {
  return (
    <div className="px-page animate-pulse" aria-hidden>
      <div className="mt-8 h-8 w-36 rounded-md bg-card" />
      <div className="mt-3 h-4 w-56 rounded-md bg-card" />
      <div className="mt-6 flex gap-2">
        <div className="h-10 w-32 rounded-pill bg-card" />
        <div className="h-10 w-36 rounded-pill bg-card" />
      </div>
      <div className="mt-4 h-14 card" />
      <div className="mt-6 space-y-3">
        <div className="h-[88px] card" />
        <div className="h-[88px] card" />
        <div className="h-[88px] card" />
      </div>
    </div>
  );
}

function PracticePageInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedLang = searchParams.get("lang")?.toLowerCase().trim() ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<PracticeMode>("smart");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [languages, setLanguages] = useState<LearningLanguage[]>([]);
  const [activeLanguage, setActiveLanguage] = useState<LearningLanguage | null>(null);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: learningRows, error: learningError } = await supabase
        .from("learning_languages")
        .select("*")
        .eq("user_id", user.id)
        .order("last_accessed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (learningError) {
        setError(learningError.message);
        setLoading(false);
        return;
      }

      const learning = (learningRows ?? []) as LearningLanguage[];
      if (learning.length === 0) {
        router.replace("/onboarding/4");
        return;
      }

      const active =
        learning.find((l) => l.language_code.toLowerCase() === requestedLang) ?? learning[0];
      setLanguages(learning);
      setActiveLanguage(active);
      setSelectedTopic(null);

      const [{ count: due, error: dueError }, { data: topicRows, error: topicsError }] =
        await Promise.all([
          supabase
            .from("flashcards")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("language_code", active.language_code)
            .lte("next_review_date", new Date().toISOString().slice(0, 10)),
          supabase
            .from("curriculum_topics")
            .select("topic_key, topic_name")
            .eq("language_code", active.language_code)
            .order("order_index", { ascending: true })
        ]);

      if (cancelled) return;

      setDueCount(dueError ? 0 : due ?? 0);

      if (topicsError) {
        setError(topicsError.message);
        setLoading(false);
        return;
      }

      const unique = new Map<string, TopicItem>();
      for (const row of (topicRows ?? []) as TopicItem[]) {
        if (!unique.has(row.topic_key)) unique.set(row.topic_key, row);
      }
      setTopics(Array.from(unique.values()));
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, supabase, requestedLang]);

  const reviewHref = useMemo(() => {
    const params = new URLSearchParams();
    if (activeLanguage) params.set("lang", activeLanguage.language_code);
    if (selectedTopic) params.set("topic", selectedTopic);
    const qs = params.toString();
    return qs ? `/practice/review?${qs}` : "/practice/review";
  }, [selectedTopic, activeLanguage]);

  if (loading) {
    return (
      <>
        <main className="mx-auto min-h-screen max-w-2xl bg-app pb-28">
          <PracticeSkeleton />
        </main>
        <BottomNav activeTab="practice" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="px-page mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center bg-app pb-28 text-center">
          <p className="text-base font-semibold text-ink">Something went wrong</p>
          <p className="mt-2 max-w-xs text-sm text-ink-secondary">{error}</p>
          <button type="button" onClick={() => router.refresh()} className="btn-secondary mt-6">
            Try again
          </button>
        </main>
        <BottomNav activeTab="practice" hasLearningLanguage={Boolean(activeLanguage)} />
      </>
    );
  }

  return (
    <>
      <main className="mx-auto min-h-screen max-w-2xl bg-app pb-32">
        <header className="px-page flex items-start justify-between gap-4 pt-10">
          <div className="min-w-0">
            <p className="label-caps">Practice</p>
            <h1 className="title-screen mt-1.5">
              Keep your {activeLanguage?.language_name ?? "vocabulary"} sharp
            </h1>
          </div>
          {activeLanguage ? (
            <LanguageSwitcher languages={languages} activeCode={activeLanguage.language_code} />
          ) : null}
        </header>

        <section className="px-page mt-8">
          <div
            className="flex gap-7 border-b border-line"
            role="tablist"
            aria-label="Practice mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "smart"}
              onClick={() => setMode("smart")}
              className={`-mb-px cursor-pointer border-b-2 pb-3 text-[15px] transition-colors duration-150 ${
                mode === "smart"
                  ? "border-[var(--accent-text)] font-semibold text-ink"
                  : "border-transparent font-medium text-ink-tertiary hover:text-ink-secondary"
              }`}
            >
              Smart review
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "topic"}
              onClick={() => setMode("topic")}
              className={`-mb-px cursor-pointer border-b-2 pb-3 text-[15px] transition-colors duration-150 ${
                mode === "topic"
                  ? "border-[var(--accent-text)] font-semibold text-ink"
                  : "border-transparent font-medium text-ink-tertiary hover:text-ink-secondary"
              }`}
            >
              Choose a topic
            </button>
          </div>
        </section>

        {mode === "smart" ? (
          <section className="px-page">
            <div className="flex items-baseline gap-4 border-b border-line py-6">
              {dueCount > 0 ? (
                <>
                  <p className="type-serif shrink-0 text-[44px] font-medium leading-none text-ink">
                    {dueCount}
                  </p>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">
                      {dueCount === 1 ? "word ready" : "words ready"} for review
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-secondary">
                      A few minutes brings them back.
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-[15px] font-medium text-ink">Nothing due right now</p>
                  <p className="mt-0.5 text-[13px] text-ink-secondary">
                    Your memory is holding up — new reviews will queue as you learn.
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="mx-page flex flex-wrap gap-2 border-b border-line py-6">
            {topics.length === 0 ? (
              <p className="text-sm text-ink-secondary">
                No topics available for {activeLanguage?.language_name} yet.
              </p>
            ) : (
              topics.map((topic) => {
                const selected = selectedTopic === topic.topic_key;
                return (
                  <button
                    key={topic.topic_key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedTopic(selected ? null : topic.topic_key)}
                    className={`chip ${selected ? "chip--selected" : ""}`}
                  >
                    {topic.topic_name}
                  </button>
                );
              })
            )}
          </section>
        )}

        <section className="px-page">
          <div className="divide-y divide-[var(--border)] border-b border-line">
            <Link href={reviewHref} className="group flex cursor-pointer items-center gap-4 py-5">
              <IconCards size={20} className="shrink-0 text-ink-tertiary" stroke={1.5} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-ink">Flashcards</p>
                <p className="mt-0.5 text-[13px] text-ink-secondary">
                  Type the translation from memory
                </p>
              </div>
              <IconChevronRight
                size={18}
                stroke={1.5}
                className="shrink-0 text-ink-tertiary transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>

            <Link
              href={
                activeLanguage
                  ? `/practice/reading?lang=${encodeURIComponent(activeLanguage.language_code)}`
                  : "/practice/reading"
              }
              className="group flex cursor-pointer items-center gap-4 py-5"
            >
              <IconFileText size={20} className="shrink-0 text-ink-tertiary" stroke={1.5} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-ink">Reading</p>
                <p className="mt-0.5 text-[13px] text-ink-secondary">
                  Read a passage, tap words to reveal
                </p>
              </div>
              <IconChevronRight
                size={18}
                stroke={1.5}
                className="shrink-0 text-ink-tertiary transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>

            <div className="flex items-center gap-4 py-5 opacity-45">
              <IconHeadphones size={20} className="shrink-0 text-ink-tertiary" stroke={1.5} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-ink">Listening</p>
                <p className="mt-0.5 text-[13px] text-ink-secondary">
                  Train your ear with short clips
                </p>
              </div>
              <span className="label-caps shrink-0">Soon</span>
            </div>

            <div className="flex items-center gap-4 py-5 opacity-45">
              <IconMessages size={20} className="shrink-0 text-ink-tertiary" stroke={1.5} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-ink">Conversation</p>
                <p className="mt-0.5 text-[13px] text-ink-secondary">
                  Practise real dialogue at your level
                </p>
              </div>
              <span className="label-caps shrink-0">Soon</span>
            </div>
          </div>
        </section>
      </main>
      <BottomNav activeTab="practice" hasLearningLanguage />
    </>
  );
}

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen max-w-2xl bg-app pb-28">
          <PracticeSkeleton />
        </main>
      }
    >
      <PracticePageInner />
    </Suspense>
  );
}
