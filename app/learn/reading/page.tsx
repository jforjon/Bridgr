"use client";

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

export default function ReadingPage() {
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

    const timeout = window.setTimeout(() => {
      setRecentKnownTapWordId(null);
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [recentKnownTapWordId]);

  const passageText = useMemo(
    () =>
      tokens
        .map((token, index) => {
          if (!token.isWord) {
            return token.word;
          }
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

    setActiveWord({
      ...token,
      word: normalizedWord
    });
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

    if (response.status === 204) {
      setHint(null);
      return;
    }

    if (response.ok) {
      const payload = (await response.json()) as { hint: Hint };
      setHint(payload.hint);
      return;
    }

    setHint(null);
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  };

  const handleSubmitQuiz = () => {
    let total = 0;
    for (const question of QUESTIONS) {
      if (answers[question.id] === question.correctAnswer) {
        total += 1;
      }
    }
    setScore(total);
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
        <main className="p-6 pb-28 text-sm text-slate-600">Loading reading module...</main>
        <BottomNav activeTab="learn" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="p-6 pb-28 text-sm text-red-600">{error}</main>
        <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-white pb-28">
      <header className="px-4 pb-4 pt-6">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-medium text-slate-700">
            Exit
          </Link>
          <p className="font-serif text-lg text-slate-900">Reading</p>
          <p className="text-sm text-slate-500">{progressCurrent} of 3</p>
        </div>
      </header>
      <div className="h-1 w-full bg-slate-100">
        <div className="h-full bg-[#2D6A4F]" style={{ width: progressWidth }} />
      </div>

      {stage === "reading" && (
        <section className="mt-6 px-4">
          <h1 className="mb-2 font-serif text-2xl text-slate-900">Read the passage</h1>
          <p className="mb-6 text-sm text-slate-600">Tap any word to see its meaning</p>

          <article className="rounded-3xl border border-slate-100 bg-white p-6 text-lg leading-9 text-slate-800">
            {tokens.map((token, index) => {
              if (!token.isWord) {
                return (
                  <span key={token.id} className="select-none">
                    {token.word}
                  </span>
                );
              }

              const prev = tokens[index - 1];
              const needsLeadingSpace = prev && prev.isWord;
              const isKnownTap = token.wordId && recentKnownTapWordId === token.wordId;

              return (
                <span key={token.id}>
                  {needsLeadingSpace ? " " : ""}
                  <span
                    role="button"
                    tabIndex={0}
                    data-word-id={token.wordId ?? ""}
                    onClick={() => void handleWordTap(token)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void handleWordTap(token);
                      }
                    }}
                    className={`rounded px-0.5 transition ${
                      isKnownTap ? "bg-green-100" : "active:bg-amber-100"
                    }`}
                  >
                    {token.word}
                  </span>
                </span>
              );
            })}
          </article>
          <div className="fixed bottom-20 left-0 right-0 z-30 border-t border-slate-100 bg-white px-4 py-4">
            <button
              type="button"
              onClick={() => setStage("questions")}
              className="w-full rounded-2xl bg-[#2D6A4F] py-4 text-sm font-semibold text-white"
            >
              Done reading
            </button>
          </div>
        </section>
      )}

      {stage === "questions" && (
        <section className="mt-6 px-4">
          <h2 className="mb-2 font-serif text-2xl text-slate-900">Check your understanding</h2>
          <p className="mb-6 text-sm text-slate-600">Answer all questions to continue</p>

          <div>
            {QUESTIONS.map((question) => (
              <div key={question.id} className="mb-4 rounded-2xl border border-slate-100 bg-white p-5">
                <p className="mb-4 text-base font-medium text-slate-900">{question.prompt}</p>
                <div>
                  {question.options.map((option) => {
                    const selected = answers[question.id] === option;

                    return (
                      <label
                        key={option}
                        className={`mb-2 block w-full cursor-pointer rounded-xl border px-4 py-3 text-left text-sm ${
                          selected
                            ? "border-[#2D6A4F] bg-green-50 text-[#2D6A4F]"
                            : "border-slate-200 text-slate-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={selected}
                          onChange={() => handleAnswerChange(question.id, option)}
                          className="sr-only"
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="fixed bottom-20 left-0 right-0 z-30 border-t border-slate-100 bg-white px-4 py-4">
            <button
              type="button"
              onClick={handleSubmitQuiz}
              disabled={Object.keys(answers).length !== QUESTIONS.length}
              className="w-full rounded-2xl bg-[#2D6A4F] py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit answers
            </button>
          </div>
        </section>
      )}

      {stage === "results" && (
        <section className="mt-6 px-4">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-green-200 bg-green-50">
            <p className="font-serif text-3xl text-green-700">
              {score ?? 0}/{QUESTIONS.length}
            </p>
          </div>
          <h2 className="mt-6 text-center font-serif text-2xl text-slate-900">Well done!</h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            {tappedUnknownWordIds.size} unknown words tapped
          </p>

          <button
            type="button"
            onClick={() => void handleAddUnknownToQueue()}
            disabled={queueSaving}
            className="mt-8 w-full rounded-2xl bg-[#2D6A4F] px-4 py-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {queueSaving ? "Adding..." : "Add unknown words to review"}
          </button>
          <Link
            href="/dashboard"
            className="mt-3 block w-full rounded-2xl border border-slate-200 py-4 text-center text-sm font-medium text-slate-600"
          >
            Back to dashboard
          </Link>
          {queueMessage ? (
            <p
              className={`mt-4 text-sm ${
                queueMessage.startsWith("Added ") ? "text-green-600" : "text-slate-600"
              }`}
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
        className={`fixed bottom-0 left-0 right-0 z-50 w-full rounded-t-3xl bg-white p-6 shadow-2xl transition-transform duration-200 ${
          activeWord ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />
        <p className="mb-1 font-serif text-3xl text-slate-900">{activeWord?.word ?? ""}</p>
        <p className="mb-4 text-base text-slate-600">{activeWord?.translation ?? ""}</p>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-xs uppercase tracking-widest text-amber-600">Hint</p>
          {hintLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-amber-200" />
              <div className="h-3 w-full animate-pulse rounded bg-amber-200" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-amber-200" />
            </div>
          ) : hint ? (
            <p className="text-sm leading-relaxed text-amber-800">{hint.hint_text}</p>
          ) : (
            <p className="text-sm leading-relaxed text-amber-800">
              No hint available yet. Tap another word or continue reading.
            </p>
          )}
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-2xl bg-[#2D6A4F] py-3 text-sm font-semibold text-white"
          onClick={() => {
            setActiveWord(null);
            setHint(null);
          }}
        >
          Got it
        </button>
      </div>

      <p className="sr-only">{passageText}</p>
      <BottomNav activeTab="learn" hasLearningLanguage={hasLearningLanguage} />
    </main>
  );
}
