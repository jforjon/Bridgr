"use client";

import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import BridgrPageLoading from "@/components/BridgrPageLoading";
import VocabularyTypingDeck, { type VocabDeckItem } from "@/components/VocabularyTypingDeck";
import { createClient } from "@/lib/supabase/client";
import type { KnownLanguage, LearningLanguage, Word } from "@/types";

export default function LearnPage() {
  const supabase = createClient();
  const [words, setWords] = useState<Word[]>([]);
  const [knownLanguageRows, setKnownLanguageRows] = useState<KnownLanguage[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>("es");
  const [hasLearningLanguage, setHasLearningLanguage] = useState(true);
  const [flashcardByWordId, setFlashcardByWordId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        setError("Please log in first.");
        return;
      }

      const [{ data: knownRows }, { data: learningRows }] = await Promise.all([
        supabase.from("known_languages").select("*").eq("user_id", user.id),
        supabase
          .from("learning_languages")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
      ]);

      const knownTyped = (knownRows ?? []) as KnownLanguage[];
      const learningTyped = (learningRows ?? []) as LearningLanguage[];
      setKnownLanguageRows(knownTyped);
      setHasLearningLanguage(learningTyped.length > 0);
      const target = learningTyped[0] ?? null;
      const effectiveTargetLanguage = target?.language_code ?? "it";

      if (target) {
        setTargetLanguage(target.language_code);
      } else {
        setTargetLanguage("it");
      }

      const { data: wordRows, error: wordError } = await supabase
        .from("words")
        .select("*")
        .eq("language_code", effectiveTargetLanguage)
        .limit(10);

      if (wordError) {
        setLoading(false);
        setError(wordError.message);
        return;
      }

      const list = (wordRows ?? []) as Word[];
      setWords(list);

      if (list.length === 0) {
        setFlashcardByWordId({});
        setLoading(false);
        return;
      }

      const wordIds = list.map((w) => w.id);
      const fcMap: Record<string, string> = {};
      if (wordIds.length > 0) {
        const { data: existingFc } = await supabase
          .from("flashcards")
          .select("id, word_id")
          .eq("user_id", user.id)
          .in("word_id", wordIds);

        for (const row of existingFc ?? []) {
          if (row.word_id && row.id) fcMap[row.word_id] = row.id;
        }

        for (const wid of wordIds) {
          if (fcMap[wid]) continue;
          const res = await fetch("/api/flashcards/upsert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              word_id: wid,
              language_code: effectiveTargetLanguage
            })
          });
          const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
          if (res.ok && data.id) {
            fcMap[wid] = data.id;
          }
        }
        setFlashcardByWordId(fcMap);
      }

      setLoading(false);
    };

    void load();
  }, [supabase]);

  const deckItems: VocabDeckItem[] = useMemo(() => {
    return words.map((w) => ({
      word_id: w.id,
      word: w.word,
      translation: w.translation,
      translation_en: w.translation,
      flashcard_id: flashcardByWordId[w.id] ?? ""
    }));
  }, [words, flashcardByWordId]);

  if (loading) {
    return (
      <BridgrPageLoading
        title="Loading words…"
        subtitle="Fetching your practice set"
        bottomSlot={<BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />}
      />
    );
  }

  if (error && words.length === 0 && !loading) {
    return (
      <>
        <main className="p-6 pb-28 text-sm text-red-600">{error}</main>
        <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
      </>
    );
  }

  if (!loading && !error && words.length === 0) {
    return (
      <>
        <main className="p-6 pb-28">
          <p className="text-sm text-slate-600">No words found for this language yet.</p>
        </main>
        <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
      </>
    );
  }

  const ready = deckItems.length > 0 && deckItems.every((d) => d.flashcard_id);

  if (!ready) {
    return (
      <BridgrPageLoading
        title="Preparing flashcards…"
        subtitle="Setting up spaced repetition"
        bottomSlot={<BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />}
      />
    );
  }

  return (
    <>
      <VocabularyTypingDeck
        items={deckItems}
        languageCode={targetLanguage}
        knownLanguageRows={knownLanguageRows}
        exitHref="/dashboard"
        exitLabel="Exit"
        hasLearningLanguage={hasLearningLanguage}
      />
    </>
  );
}
