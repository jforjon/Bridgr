"use client";

import { IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/client";
import type { Hint, KnownLanguage, LearningLanguage, Proficiency } from "@/types";

interface PassageToken {
  id: string;
  wordId: string | null;
  word: string;
  translation: string;
  isWord: boolean;
}

interface KnownLanguageInput {
  language: string;
  languageCode: string;
  proficiency: Proficiency;
}

interface Question {
  id: string;
  type: "boolean" | "multiple";
  prompt: string;
  options: string[];
  correctAnswer: string;
}

type Stage = "reading" | "questions" | "results";

const FALLBACK_PASSAGE =
  "La famiglia è molto importante nella cultura italiana. " +
  "L'amore per la natura e la musica è parte della vita quotidiana. " +
  "È possibile trovare arte e cultura in ogni città italiana. " +
  "La nazione ha una storia antica e affascinante. " +
  "Gli animali selvatici vivono nella natura meravigliosa del paese.";

const QUESTIONS: Question[] = [
  {
    id: "q1",
    type: "boolean",
    prompt: "The narrator buys food at a neighborhood market.",
    options: ["True", "False"],
    correctAnswer: "True"
  },
  {
    id: "q2",
    type: "multiple",
    prompt: "What does the narrator share with their sister?",
    options: ["Tea and cookies", "Bread, fruit, and coffee", "Soup and rice", "Only fruit"],
    correctAnswer: "Bread, fruit, and coffee"
  },
  {
    id: "q3",
    type: "multiple",
    prompt: "What does the narrator hear at home while organizing the day?",
    options: ["Cars", "Rain", "Birds", "Music"],
    correctAnswer: "Birds"
  }
];

export default function PracticeReadingPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<Stage>("reading");
  const [tokens, setTokens] = useState<PassageToken[]>([]);
  const [knownWordIds, setKnownWordIds] = useState<Set<string>>(new Set());
  const [knownLanguages, setKnownLanguages] = useState<KnownLanguageInput[]>([]);
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [hasLearningLanguage, setHasLearningLanguage] = useState(true);
  const [activeWord, setActiveWord] = useState<PassageToken | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [recentKnownTapWordId, setRecentKnownTapWordId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number | null>(null);
  const [queueSaving, setQueueSaving] = useState(false);
  const [queueMessage, setQueueMessage] = useState("");
  const [tappedUnknownWordIds, setTappedUnknownWordIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please log in first.");
        setLoading(false);
        return;
      }

      const [{ data: knownRows, error: knownError }, { data: learningRows, error: learningError }] =
        await Promise.all([
          supabase.from("known_languages").select("*").eq("user_id", user.id),
          supabase
            .from("learning_languages")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
        ]);

      if (knownError) {
        setError(knownError.message);
        setLoading(false);
        return;
      }
      if (learningError) {
        setError(learningError.message);
        setLoading(false);
        return;
      }

      const knownTyped = (knownRows ?? []) as KnownLanguage[];
      const learningTyped = (learningRows ?? []) as LearningLanguage[];
      setHasLearningLanguage(learningTyped.length > 0);
      const target = learningTyped[0] ?? null;
      const selectedTargetLanguage = target?.language_code ?? "es";
      setTargetLanguage(selectedTargetLanguage);

      const knownLanguageRows = knownTyped.map((row) => ({
        language: row.language_name,
        languageCode: row.language_code,
        proficiency: row.proficiency
      }));

      setKnownLanguages(
        knownLanguageRows.length
          ? knownLanguageRows
          : [{ language: "English", languageCode: "en", proficiency: "C2" }]
      );

      const { data: knownCards, error: knownCardsError } = await supabase
        .from("flashcards")
        .select("word_id")
        .eq("user_id", user.id)
        .gt("ease_factor", 2.5);

      if (knownCardsError) {
        setError(knownCardsError.message);
        setLoading(false);
        return;
      }

      setKnownWordIds(new Set((knownCards ?? []).map((card) => card.word_id as string)));

      const { data: wordsRows, error: wordsError } = await supabase
        .from("words")
        .select("id,word,translation,language_code")
        .eq("language_code", selectedTargetLanguage)
        .limit(160);

      if (wordsError) {
        setError(wordsError.message);
        setLoading(false);
        return;
      }

      const sourceWords = (wordsRows ?? []) as Array<{
        id: string;
        word: string;
        translation: string;
      }>;

      if (sourceWords.length >= 60) {
        const selected = sourceWords.slice(0, 120);
        const generatedTokens = selected.map((entry, index) => ({
          id: `token-${entry.id}-${index}`,
          wordId: entry.id,
          word: entry.word,
          translation: entry.translation,
          isWord: true
        }));
        setTokens(generatedTokens);
      } else {
        const fallbackWords = FALLBACK_PASSAGE.match(/[\p{L}']+|[^\s\p{L}']+/gu) ?? [];
        const generatedTokens = fallbackWords.map((token, index) => {
          const normalized = token.toLowerCase();
          const match = sourceWords.find((entry) => entry.word.toLowerCase() === normalized);

          const isWord = /[\p{L}']/u.test(token);
          return {
            id: `fallback-${index}`,
            wordId: match?.id ?? null,
            word: token,
            translation: match?.translation ?? "Translation unavailable",
            isWord
          } satisfies PassageToken;
        });
        setTokens(generatedTokens);
      }

      setLoading(false);
    };

    void load();
  }, [supabase]);

  useEffect(() => {
    if (!recentKnownTapWordId) return;
    const timeout = window.setTimeout(() => setRecentKnownTapWordId(null), 500);
    return () => window.clearTimeout(timeout);
  }, [recentKnownTapWordId]);

  const passageText = useMemo(
    () =>
      tokens
        .map((token, index) => {
          if (!token.isWord) return token.word;
          const prev = tokens[index - 1];
          return `${prev && prev.isWord ? " " : ""}${token.word}`;
        })
        .join(""),
    [tokens]
  );

  const progressCurrent = stage === "reading" ? 1 : stage === "questions" ? 2 : 3;
  const progressWidth = progressCurrent === 1 ? "33%" : progressCurrent === 2 ? "66%" : "100%";

  const handleWordTap = async (token: PassageToken) => {
    if (!token.isWord) return;
    const normalizedWord = token.word.replace(/[^\p{L}']/gu, "");
    if (!normalizedWord) return;

    const isKnown = token.wordId ? knownWordIds.has(token.wordId) : false;
    if (isKnown && token.wordId) {
      setRecentKnownTapWordId(token.wordId);
      setActiveWord(null);
      setHint(null);
      return;
    }

    if (token.wordId) {
      setTappedUnknownWordIds((current) => {
        const next = new Set(current);
        next.add(token.wordId as string);
        return next;
      });
    }

    setActiveWord({ ...token, word: normalizedWord });
    setHint(null);
    setHintLoading(true);

    if (!token.wordId) {
      setHintLoading(false);
      return;
    }

    const response = await fetch("/api/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wordId: token.wordId,
        word: normalizedWord,
        targetLanguage,
        knownLanguages
      })
    });

    setHintLoading(false);
    if (response.status === 204) return setHint(null);
    if (response.ok) {
      const payload = (await response.json()) as { hint: Hint };
      setHint(payload.hint);
      return;
    }
    setHint(null);
  };

  const handleSubmitQuiz = () => {
    let total = 0;
    for (const question of QUESTIONS) {
      if (answers[question.id] === question.correctAnswer) total += 1;
    }
    setScore(total);
    void fetch("/api/streak/session", {
      method: "POST",
      credentials: "include"
    });
    setStage("results");
  };

  const handleAddUnknownToQueue = async () => {
    setQueueSaving(true);
    setQueueMessage("");

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setQueueSaving(false);
      setQueueMessage("Please log in first.");
      return;
    }

    const unknownIds = Array.from(tappedUnknownWordIds);
    if (!unknownIds.length) {
      setQueueSaving(false);
      setQueueMessage("No unknown tapped words to add.");
      return;
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("flashcards")
      .select("word_id")
      .eq("user_id", user.id)
      .in("word_id", unknownIds);

    if (existingError) {
      setQueueSaving(false);
      setQueueMessage("Could not check existing flashcards.");
      return;
    }

    const existingWordIds = new Set((existingRows ?? []).map((row) => row.word_id as string));
    const rowsToInsert = unknownIds
      .filter((wordId) => !existingWordIds.has(wordId))
      .map((wordId) => ({
        user_id: user.id,
        word_id: wordId,
        ease_factor: 2.3,
        interval_days: 1,
        repetitions: 0,
        next_review_date: new Date().toISOString().split("T")[0],
        last_quality: null
      }));

    if (!rowsToInsert.length) {
      setQueueSaving(false);
      setQueueMessage("All tapped unknown words are already in your review queue.");
      return;
    }

    const { error: insertError } = await supabase.from("flashcards").insert(rowsToInsert);
    setQueueSaving(false);
    if (insertError) {
      setQueueMessage("Failed to add words to review queue.");
      return;
    }
    setQueueMessage(`Added ${rowsToInsert.length} word(s) to your review queue.`);
  };

  if (loading) {
    return (
      <>
        <main className="bg-teal-900 p-6 pb-28 text-sm text-teal-200">Loading reading module...</main>
        <BottomNav activeTab="practice" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="bg-teal-900 p-6 pb-28 text-sm text-red-400">{error}</main>
        <BottomNav activeTab="practice" hasLearningLanguage={hasLearningLanguage} />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-teal-900 pb-28">
      <header className="px-4 pb-4 pt-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link
            href="/practice"
            aria-label="Exit reading"
            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#1a3d38] text-[#8fbfb8] transition hover:opacity-90"
          >
            <IconX size={18} stroke={1.75} />
          </Link>
          <p className="text-center text-[13px] font-bold text-[#8fbfb8]">{`${progressCurrent} / 3`}</p>
          <span className="h-[36px] w-[36px] shrink-0" aria-hidden />
        </div>
      </header>
      <div className="h-2 w-full overflow-hidden rounded-full bg-teal-700">
        <div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: progressWidth }} />
      </div>

      {stage === "reading" && (
        <section className="mt-6 px-4">
          <h1 className="mb-2 font-sans text-2xl font-extrabold text-white">Read the passage</h1>
          <p className="mb-6 text-sm text-teal-200">Tap any word to see its meaning</p>
          <article className="rounded-xl border border-teal-400/30 bg-teal-800 p-6 text-lg leading-9 text-teal-100">
            {tokens.map((token, index) => {
              if (!token.isWord) return <span key={token.id}>{token.word}</span>;
              const prev = tokens[index - 1];
              const isKnownTap = token.wordId && recentKnownTapWordId === token.wordId;
              return (
                <span key={token.id}>
                  {prev && prev.isWord ? " " : ""}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleWordTap(token)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void handleWordTap(token);
                      }
                    }}
                    className={`rounded px-0.5 ${isKnownTap ? "bg-lime-300/10" : "active:bg-amber/10"}`}
                  >
                    {token.word}
                  </span>
                </span>
              );
            })}
          </article>
          <div className="fixed bottom-20 left-0 right-0 z-30 border-t border-teal-700/50 bg-teal-900 px-4 py-4">
            <button
              type="button"
              onClick={() => setStage("questions")}
              className="w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700"
            >
              Done reading
            </button>
          </div>
        </section>
      )}

      {stage === "questions" && (
        <section className="mt-6 px-4">
          <h2 className="mb-2 font-sans text-2xl font-extrabold text-white">Check your understanding</h2>
          <p className="mb-6 text-sm text-teal-200">Answer all questions to continue</p>
          {QUESTIONS.map((question) => (
            <div key={question.id} className="mb-4 rounded-xl border border-teal-400/30 bg-teal-800 p-5">
              <p className="mb-4 text-base font-bold text-white">{question.prompt}</p>
              {question.options.map((option) => {
                const selected = answers[question.id] === option;
                return (
                  <label
                    key={option}
                    className={`mb-2 block cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold ${
                      selected
                        ? "border-lime-300/50 bg-lime-300/10 text-lime-300"
                        : "border-teal-400/30 text-teal-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      checked={selected}
                      onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                      className="sr-only"
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          ))}
          <div className="fixed bottom-20 left-0 right-0 z-30 border-t border-teal-700/50 bg-teal-900 px-4 py-4">
            <button
              type="button"
              onClick={handleSubmitQuiz}
              disabled={Object.keys(answers).length !== QUESTIONS.length}
              className="w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700 disabled:opacity-50"
            >
              Submit answers
            </button>
          </div>
        </section>
      )}

      {stage === "results" && (
        <section className="mt-6 px-4">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-lime-300/30 bg-lime-300/10">
            <p className="font-sans text-3xl font-extrabold text-lime-300">
              {score ?? 0}/{QUESTIONS.length}
            </p>
          </div>
          <h2 className="mt-6 text-center font-sans text-2xl font-extrabold text-white">Well done!</h2>
          <p className="mt-2 text-center text-sm text-teal-200">
            {tappedUnknownWordIds.size} unknown words tapped
          </p>
          <button
            type="button"
            onClick={() => void handleAddUnknownToQueue()}
            disabled={queueSaving}
            className="mt-8 w-full rounded-full bg-lime-300 px-4 py-4 text-base font-extrabold text-lime-700 disabled:opacity-60"
          >
            {queueSaving ? "Adding..." : "Add unknown words to review"}
          </button>
          <Link
            href="/learn"
            className="mt-3 block w-full rounded-full border border-teal-400/30 py-4 text-center text-sm font-extrabold text-teal-200"
          >
            Back to home
          </Link>
          {queueMessage ? (
            <p
              className={`mt-4 text-sm ${queueMessage.startsWith("Added ") ? "text-lime-300" : "text-teal-200"}`}
            >
              {queueMessage}
            </p>
          ) : null}
        </section>
      )}

      <div
        className={`fixed inset-0 z-40 bg-black/40 transition ${
          activeWord ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          setActiveWord(null);
          setHint(null);
        }}
        aria-hidden={!activeWord}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-teal-400/30 bg-teal-800 p-6 shadow-2xl transition-transform ${
          activeWord ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-teal-600" />
        <p className="mb-1 font-sans text-3xl font-extrabold text-white">{activeWord?.word ?? ""}</p>
        <p className="mb-4 text-base text-teal-200">{activeWord?.translation ?? ""}</p>
        <div className="rounded-xl border border-amber/20 bg-amber/10 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber">Hint</p>
          {hintLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-amber/20" />
              <div className="h-3 w-full animate-pulse rounded bg-amber/20" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-amber/20" />
            </div>
          ) : hint ? (
            <p className="text-sm leading-relaxed text-amber">{hint.hint_text}</p>
          ) : (
            <p className="text-sm leading-relaxed text-amber">
              No hint available yet. Tap another word or continue reading.
            </p>
          )}
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-full bg-lime-300 py-3 text-base font-extrabold text-lime-700"
          onClick={() => {
            setActiveWord(null);
            setHint(null);
          }}
        >
          Got it
        </button>
      </div>

      <p className="sr-only">{passageText}</p>
      <BottomNav activeTab="practice" hasLearningLanguage={hasLearningLanguage} />
    </main>
  );
}
