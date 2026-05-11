"use client";

import Link from "next/link";
import {
  IconCards,
  IconChevronRight,
  IconFileText,
  IconHeadphones,
  IconMessages
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/client";
import type { LearningLanguage } from "@/types";

type PracticeMode = "smart" | "topic";

type TopicItem = {
  topic_key: string;
  topic_name: string;
};

export default function PracticePage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<PracticeMode>("smart");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<LearningLanguage | null>(null);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
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

      const [{ data: learningRows, error: learningError }, { count: due, error: dueError }] =
        await Promise.all([
          supabase
            .from("learning_languages")
            .select("*")
            .eq("user_id", user.id)
            .order("last_accessed_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: true }),
          supabase
            .from("flashcards")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .lte("next_review_date", new Date().toISOString().slice(0, 10))
        ]);

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

      const active = learning[0];
      setActiveLanguage(active);
      setDueCount(dueError ? 0 : due ?? 0);

      const { data: topicRows, error: topicsError } = await supabase
        .from("curriculum_topics")
        .select("topic_key, topic_name")
        .eq("language_code", active.language_code)
        .order("order_index", { ascending: true });

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
  }, [router, supabase]);

  const reviewHref = useMemo(() => {
    if (!selectedTopic) return "/practice/review";
    return `/practice/review?topic=${encodeURIComponent(selectedTopic)}`;
  }, [selectedTopic]);

  if (loading) {
    return (
      <>
        <main className="bg-teal-900 p-6 pb-24 text-sm text-teal-200">Loading practice...</main>
        <BottomNav activeTab="practice" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="bg-teal-900 p-6 pb-24 text-sm text-red-400">{error}</main>
        <BottomNav activeTab="practice" hasLearningLanguage={Boolean(activeLanguage)} />
      </>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-teal-900 pb-24">
        <header className="px-5 pt-8">
          <h1 className="font-sans text-3xl font-extrabold text-white">Practice</h1>
          <p className="mt-1 text-sm text-teal-200">What do you want to work on?</p>
        </header>

        <section className="mt-6 px-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("smart")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                mode === "smart"
                  ? "bg-lime-300 text-lime-700"
                  : "border border-teal-400 bg-transparent text-teal-200"
              }`}
            >
              Smart review
            </button>
            <button
              type="button"
              onClick={() => setMode("topic")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                mode === "topic"
                  ? "bg-lime-300 text-lime-700"
                  : "border border-teal-400 bg-transparent text-teal-200"
              }`}
            >
              Choose a topic
            </button>
          </div>
        </section>

        {mode === "smart" ? (
          <section className="mx-5 mt-4 rounded-lg border border-lime-300/20 bg-lime-300/10 p-3">
            <p className="text-sm text-lime-300">
              {dueCount > 0
                ? `Your review queue: ${dueCount} words due today`
                : "You're all caught up! Check back tomorrow."}
            </p>
          </section>
        ) : (
          <section className="mt-4 flex flex-wrap gap-2 px-5">
            {topics.map((topic) => {
              const selected = selectedTopic === topic.topic_key;
              return (
                <button
                  key={topic.topic_key}
                  type="button"
                  onClick={() => setSelectedTopic(topic.topic_key)}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold ${
                    selected
                      ? "border-lime-300 bg-lime-300/10 text-lime-300"
                      : "border-teal-400 bg-transparent text-teal-200"
                  }`}
                >
                  {topic.topic_name}
                </button>
              );
            })}
          </section>
        )}

        <section className="mt-6 flex flex-col gap-3 px-5">
          <Link
            href={reviewHref}
            className="flex items-center gap-4 rounded-lg border border-teal-400 bg-teal-800 p-5"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lime-300/10">
              <IconCards size={24} className="text-lime-300" stroke={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-white">Flashcards</p>
              <p className="text-sm text-teal-200">Type the translation from memory</p>
            </div>
            <IconChevronRight size={20} stroke={1.75} className="text-teal-300" />
          </Link>

          <Link
            href="/practice/reading"
            className="flex items-center gap-4 rounded-lg border border-teal-400 bg-teal-800 p-5"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700">
              <IconFileText size={24} className="text-teal-200" stroke={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-white">Reading</p>
              <p className="text-sm text-teal-200">Read a passage, tap words to reveal</p>
            </div>
            <IconChevronRight size={20} stroke={1.75} className="text-teal-300" />
          </Link>

          <div className="relative flex items-center gap-4 rounded-lg border border-teal-400 bg-teal-800 p-5 opacity-60">
            <span className="absolute right-4 top-4 rounded-full border border-teal-400 bg-teal-850 px-2 py-0.5 text-xs text-teal-300">
              Soon
            </span>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-800">
              <IconHeadphones size={24} className="text-teal-300" stroke={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-white">Listening</p>
              <p className="text-sm text-teal-200">Coming soon</p>
            </div>
          </div>

          <div className="relative flex items-center gap-4 rounded-lg border border-teal-400 bg-teal-800 p-5 opacity-60">
            <span className="absolute right-4 top-4 rounded-full border border-teal-400 bg-teal-850 px-2 py-0.5 text-xs text-teal-300">
              Soon
            </span>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-800">
              <IconMessages size={24} className="text-teal-300" stroke={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-white">Conversation</p>
              <p className="text-sm text-teal-200">Coming soon</p>
            </div>
          </div>
        </section>
      </main>
      <BottomNav activeTab="practice" hasLearningLanguage />
    </>
  );
}
