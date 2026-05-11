"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { useParams, useRouter } from "next/navigation";
import BridgrPageLoading from "@/components/BridgrPageLoading";
import { createClient } from "@/lib/supabase/client";
import { SUPPORTED_LANGUAGES } from "@/types";

const CEFR_SCALE: Array<"A1" | "A2" | "B1" | "B2" | "C1" | "C2"> = ["A1", "A2", "B1", "B2", "C1", "C2"];

type Stage = 1 | 2 | 3 | 4 | "generating";

interface PlacementQuestionClient {
  id: string;
  section: "vocabulary" | "grammar" | "reading" | "writing";
  cefr_level: string;
  prompt: string;
  /** Passage / extra context (optional). */
  context_text?: string | null;
  options: string[] | null;
  order_index: number;
  skippable: boolean;
}

interface SubmitResult {
  cefr_level: string;
  score: number;
  total: number;
  weak_areas: string[];
}

function resolveLanguageName(code: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  if (found) return found.name;
  if (code === "ca") return "Catalan";
  return code.length > 0 ? code.charAt(0).toUpperCase() + code.slice(1) : "this language";
}

function isMultipleChoice(q: PlacementQuestionClient): boolean {
  return Array.isArray(q.options) && q.options.length > 0;
}

function renderPromptWithTranslation(prompt: string) {
  const match = prompt.match(/^([\s\S]+?)\s*(\([^)]+\))\s*$/);
  if (!match) return <p className="font-sans font-extrabold text-xl text-white">{prompt}</p>;
  return (
    <div>
      <p className="font-sans font-extrabold text-xl text-white">{match[1].trim()}</p>
      <p className="mt-2 text-sm italic text-teal-300">{match[2]}</p>
    </div>
  );
}

export default function PlacementTestPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const languageCode = typeof params.language === "string" ? params.language.toLowerCase().trim() : "";
  const languageName = useMemo(() => resolveLanguageName(languageCode), [languageCode]);

  const [stage, setStage] = useState<Stage>(1);
  const [error, setError] = useState("");
  /** Non-blocking notice when fewer than 10 questions were parsed (shown under the progress bar). */
  const [generateWarning, setGenerateWarning] = useState("");
  const [introGenerating, setIntroGenerating] = useState(false);
  const [selfReportLevel, setSelfReportLevel] = useState<(typeof CEFR_SCALE)[number] | null>(null);
  const [selfReportSubmitting, setSelfReportSubmitting] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [knownLanguages, setKnownLanguages] = useState<
    Array<{ language_name: string; language_code: string }>
  >([]);
  const [rotatingIndex, setRotatingIndex] = useState(0);

  const [testSessionId, setTestSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PlacementQuestionClient[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersById, setAnswersById] = useState<Record<string, string>>({});
  const [fillDraft, setFillDraft] = useState("");

  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const bridgesPhrase = useMemo(() => {
    const names = knownLanguages.map((k) => k.language_name?.trim()).filter(Boolean) as string[];
    if (names.length === 0) return "languages you already speak";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  }, [knownLanguages]);

  const rotatingMessages = useMemo(
    () => [
      "Analysing your language background...",
      `Finding bridges from ${bridgesPhrase}...`,
      "Ordering topics for your profile...",
      "Almost ready..."
    ],
    [bridgesPhrase]
  );

  useEffect(() => {
    const q = questions[currentIndex];
    if (!q) {
      setFillDraft("");
      return;
    }
    if (isMultipleChoice(q)) {
      setFillDraft("");
      return;
    }
    setFillDraft(answersById[q.id] ?? "");
  }, [currentIndex, questions, answersById]);

  useEffect(() => {
    if (stage !== 2 && stage !== 3) {
      setExitConfirmOpen(false);
    }
  }, [stage]);

  useEffect(() => {
    if (!languageCode) return;
    const loadKnown = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("known_languages")
        .select("language_name, language_code")
        .eq("user_id", user.id);
      setKnownLanguages((data ?? []) as Array<{ language_name: string; language_code: string }>);
    };
    void loadKnown();
  }, [languageCode, supabase]);

  useEffect(() => {
    if (stage !== "generating") return;
    setRotatingIndex(0);
    const n = rotatingMessages.length;
    const id = window.setInterval(() => {
      setRotatingIndex((i) => (i + 1) % n);
    }, 3000);
    return () => window.clearInterval(id);
  }, [stage, rotatingMessages.length]);

  const currentQuestion = questions[currentIndex] ?? null;
  const totalQuestions = questions.length;
  const progressPct = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  const canAdvance = useMemo(() => {
    if (!currentQuestion) return false;
    if (currentQuestion.skippable) return true;
    if (isMultipleChoice(currentQuestion)) {
      const v = answersById[currentQuestion.id];
      return Boolean(v && v.length > 0);
    }
    return fillDraft.trim().length > 0;
  }, [currentQuestion, answersById, fillDraft]);

  const startTest = useCallback(async () => {
    setError("");
    setGenerateWarning("");
    setIntroGenerating(true);
    try {
      const res = await fetch("/api/placement/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language_code: languageCode,
          language_name: languageName
        })
      });
      const data = (await res.json().catch(() => ({}))) as {
        test_session_id?: string;
        questions?: PlacementQuestionClient[];
        error?: string;
        warning?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not start the test.");
        if (data.warning) setGenerateWarning(data.warning);
        return;
      }
      if (!data.test_session_id || !Array.isArray(data.questions) || data.questions.length === 0) {
        setError("Invalid response from server.");
        return;
      }
      if (data.warning) setGenerateWarning(data.warning);
      setTestSessionId(data.test_session_id);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setAnswersById({});
      setStage(2);
    } finally {
      setIntroGenerating(false);
    }
  }, [languageCode, languageName]);

  const confirmSelfReportLevel = useCallback(async () => {
    if (!selfReportLevel) return;
    setError("");
    setSelfReportSubmitting(true);
    try {
      const res = await fetch("/api/placement/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skipped: true,
          cefr_level: selfReportLevel,
          language_code: languageCode,
          language_name: languageName
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save your level.");
        return;
      }
      router.push("/learn");
    } finally {
      setSelfReportSubmitting(false);
    }
  }, [languageCode, languageName, router, selfReportLevel]);

  const skipAsBeginner = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/placement/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          skipped: true,
          cefr_level: "A1",
          language_code: languageCode,
          language_name: languageName
        })
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        skipped?: boolean;
        cefr_level?: string;
      };
      console.log("skip response:", res.status, data);
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?redirectedFrom=/placement/${encodeURIComponent(languageCode)}`);
          return;
        }
        setStage(1);
        setError(data.error ?? "Could not save your choice.");
        return;
      }
      router.push("/learn");
      console.log("router.push called");
    } catch {
      setStage(1);
      setError("Network error while saving.");
    }
  }, [languageCode, languageName, router]);

  const selectOption = (option: string) => {
    if (!currentQuestion) return;
    setAnswersById((prev) => ({ ...prev, [currentQuestion.id]: option }));
  };

  const proceedAfterAnswering = useCallback(
    async (mergedAnswers: Record<string, string>, forceSubmit = false) => {
      const isLast = currentIndex >= totalQuestions - 1;
      if (!isLast && !forceSubmit) {
        setCurrentIndex((i) => i + 1);
        return;
      }

      if (!testSessionId) {
        setError("Session expired. Please start again.");
        setStage(1);
        return;
      }

      const finalAnswers = mergedAnswers;

      setStage(3);
      setError("");

      try {
        const res = await fetch("/api/placement/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            test_session_id: testSessionId,
            answers: questions.map((q) => ({
              question_id: q.id,
              answer: finalAnswers[q.id] ?? ""
            }))
          })
        });
        const data = (await res.json().catch(() => ({}))) as SubmitResult & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not submit answers.");
          setStage(2);
          return;
        }
        setSubmitResult({
          cefr_level: data.cefr_level,
          score: data.score,
          total: data.total,
          weak_areas: Array.isArray(data.weak_areas) ? data.weak_areas : []
        });
        setStage(4);
      } catch {
        setError("Network error while submitting.");
        setStage(2);
      }
    },
    [currentIndex, questions, testSessionId, totalQuestions]
  );

  const handleFinishEarly = useCallback(async () => {
    if (!currentQuestion || !testSessionId) return;
    setError("");
    const merged: Record<string, string> = { ...answersById };
    for (const q of questions) {
      if (q.id === currentQuestion.id) {
        merged[q.id] = isMultipleChoice(q) ? (answersById[q.id] ?? "") : fillDraft.trim();
      } else {
        merged[q.id] = answersById[q.id] ?? "";
      }
      if ((merged[q.id] ?? "").trim() === "") {
        merged[q.id] = "";
      }
    }
    setAnswersById(merged);
    await proceedAfterAnswering(merged, true);
  }, [
    answersById,
    currentQuestion,
    fillDraft,
    proceedAfterAnswering,
    questions,
    testSessionId
  ]);

  const goNext = async () => {
    if (!currentQuestion || !canAdvance) return;

    const thisAnswer = isMultipleChoice(currentQuestion)
      ? (answersById[currentQuestion.id] ?? "")
      : fillDraft.trim();

    const mergedAnswers: Record<string, string> = {
      ...answersById,
      [currentQuestion.id]: thisAnswer
    };

    setAnswersById(mergedAnswers);
    await proceedAfterAnswering(mergedAnswers);
  };

  const handleDontKnow = async () => {
    if (!currentQuestion) return;
    const mergedAnswers: Record<string, string> = {
      ...answersById,
      [currentQuestion.id]: ""
    };
    setAnswersById(mergedAnswers);
    setFillDraft("");
    await proceedAfterAnswering(mergedAnswers);
  };

  const finishAndOpenCourse = async () => {
    setError("");
    setStage("generating");

    const maxTries = 60;
    for (let i = 0; i < maxTries; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      try {
        const statusRes = await fetch(
          `/api/course/status?language_code=${encodeURIComponent(languageCode)}`,
          { method: "GET", credentials: "include" }
        );
        const statusPayload = (await statusRes.json().catch(() => ({}))) as { exists?: boolean };
        if (statusRes.ok && statusPayload.exists) {
          router.push("/learn");
          return;
        }
      } catch {
        // keep polling
      }
    }

    // Timed out — go anyway, learn page will handle it
    router.push("/learn");
  };

  if (!languageCode) {
    return (
      <main className="min-h-screen bg-teal-900 px-6 py-10">
        <p className="text-sm text-red-400">Invalid language.</p>
      </main>
    );
  }

  if (stage === "generating") {
    return (
      <BridgrPageLoading title="Building your personal course" subtitle={null}>
        <p
          key={rotatingIndex}
          className="mt-3 text-center text-sm text-teal-300 transition-opacity duration-500"
        >
          {rotatingMessages[rotatingIndex]}
        </p>
      </BridgrPageLoading>
    );
  }

  if (introGenerating) {
    return (
      <BridgrPageLoading
        title="Loading your test…"
        subtitle="This usually takes a moment"
      />
    );
  }

  if (stage === 3) {
    return (
      <BridgrPageLoading
        title="Analysing your results…"
        subtitle="This may take a moment"
      />
    );
  }

  return (
    <main
      className={`min-h-screen bg-teal-900 px-5 ${stage === 1 ? "pt-0" : "pt-8"} ${stage === 2 ? "pb-32" : "pb-28"}`}
    >
      {stage === 1 ? (
        <>
          <div className="flex items-center justify-between px-6 pt-6">
            <button
              type="button"
              onClick={() => router.push("/learn")}
              className="rounded-lg p-1 hover:bg-teal-800"
              aria-label="Close"
            >
              <IconX size={20} stroke={1.75} className="text-teal-300" />
            </button>
            <div className="shrink-0" aria-hidden />
          </div>
          <section className="mx-auto max-w-lg">
          <h1 className="font-sans font-extrabold text-3xl text-white">Test your {languageName}</h1>
          <p className="mt-3 text-sm text-teal-200">
            30 questions to find your level. Writing items are optional. Takes about 10–15 minutes.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-400 bg-teal-800 px-3 py-3">
            {CEFR_SCALE.map((level) => (
              <span
                key={level}
                className="min-w-[2.25rem] rounded-full border border-teal-400 bg-teal-850 py-2 text-center text-xs font-semibold text-teal-200"
              >
                {level}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-teal-300">A1 through C2 — where will you land?</p>

          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

          <div className="mt-10 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => void startTest()}
                  className="w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700"
                >
                  Start placement test
                </button>
                <button
                  type="button"
                  disabled={introGenerating}
                  onClick={() => {
                    setStage("generating");
                    void skipAsBeginner();
                  }}
                  className="w-full rounded-full border border-teal-400 bg-teal-800 py-4 text-base font-extrabold text-teal-200 disabled:opacity-50"
                >
                  I&apos;m a complete beginner
                </button>
              </div>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-teal-400" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-widest text-teal-300">
                  <span className="bg-teal-900 px-3">or</span>
                </div>
              </div>

              <div>
                <p className="text-center text-sm font-medium text-white">
                  I already know my CEFR level
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {CEFR_SCALE.map((level) => {
                    const selected = selfReportLevel === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSelfReportLevel(selected ? null : level)}
                        className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                          selected
                            ? "border-lime-300 bg-lime-300 text-lime-700"
                            : "border-teal-400 text-teal-200"
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
                {selfReportLevel ? (
                  <button
                    type="button"
                    disabled={selfReportSubmitting}
                    onClick={() => void confirmSelfReportLevel()}
                    className="mt-6 w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700 disabled:opacity-50"
                  >
                    {selfReportSubmitting ? "Saving…" : "Confirm my level"}
                  </button>
                ) : null}
              </div>
        </section>
        </>
      ) : null}

      {stage === 2 && currentQuestion ? (
        <>
          {exitConfirmOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
              <div className="w-full max-w-sm rounded-2xl border border-teal-400 bg-teal-800 p-6 text-center">
                <p className="text-base font-extrabold text-white">Exit the test?</p>
                <p className="mt-2 text-sm text-teal-200">Your progress will be lost.</p>
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setExitConfirmOpen(false)}
                    className="w-full rounded-full bg-lime-300 py-3 text-sm font-extrabold text-lime-700"
                  >
                    Keep going
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/learn")}
                    className="w-full rounded-full border border-teal-400 py-3 text-sm font-extrabold text-teal-200"
                  >
                    Exit test
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="sticky top-0 z-40 -mx-5 border-b border-teal-700/50 bg-teal-900/95 px-5 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-lg items-center justify-between">
              <button
                type="button"
                onClick={() => setExitConfirmOpen(true)}
                className="rounded-lg p-1 hover:bg-teal-800"
                aria-label="Exit placement test"
              >
                <IconX size={20} stroke={1.75} className="text-teal-300" />
              </button>
              <button
                type="button"
                onClick={() => void handleFinishEarly()}
                className="text-sm font-medium text-teal-300 underline"
              >
                Finish test
              </button>
            </div>
          </div>

        <section className="mx-auto max-w-lg">
          <div className="mb-6">
            <div className="mb-1 flex justify-between text-xs text-teal-300">
              <span>
                {currentIndex + 1} of {totalQuestions}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-teal-700">
              <div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            {generateWarning ? (
              <p className="mt-3 rounded-lg border border-amber/20 bg-amber/10 p-3 text-sm text-amber">
                {generateWarning}
              </p>
            ) : null}
          </div>

          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-teal-300">
            {currentQuestion.section}
          </p>
          {renderPromptWithTranslation(currentQuestion.prompt)}

          {currentQuestion.context_text && currentQuestion.context_text.trim() ? (
            <div className="mt-4 rounded-lg border border-teal-400 bg-teal-850 p-4 text-sm leading-relaxed text-teal-100">
              {currentQuestion.context_text}
            </div>
          ) : null}

          {isMultipleChoice(currentQuestion) ? (
            <div className="mt-6 flex flex-col gap-3">
              {(currentQuestion.options ?? []).map((opt) => {
                const selected = answersById[currentQuestion.id] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => selectOption(opt)}
                    className={`w-full rounded-lg border py-4 px-4 text-left text-sm font-semibold transition-colors ${
                      selected
                        ? "border-lime-300 bg-lime-300/10 text-white"
                        : "border-teal-400 bg-teal-800 text-white"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-6">
              <input
                type="text"
                value={fillDraft}
                onChange={(e) => setFillDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canAdvance) {
                    e.preventDefault();
                    void goNext();
                  }
                }}
                placeholder="Your answer"
                className="w-full rounded-lg border border-teal-400 bg-teal-850 px-4 py-3 text-base text-white placeholder:text-teal-300 outline-none focus:border-lime-300"
              />
            </div>
          )}

          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        </section>

        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-teal-700/50 bg-teal-900 px-6 py-4">
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => void goNext()}
              className="w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700 disabled:opacity-50"
            >
              {currentIndex >= totalQuestions - 1 ? "Finish" : "Next"}
            </button>
            <button
              type="button"
              onClick={() => void handleDontKnow()}
              className="w-full cursor-pointer border-none bg-transparent py-1 text-center text-sm text-teal-300 underline"
            >
              I don&apos;t know
            </button>
          </div>
        </div>
        </>
      ) : null}

      {stage === 4 && submitResult ? (
        <section className="mx-auto max-w-lg text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-teal-300">
            Your {languageName} level
          </p>
          <p className="mt-2 font-sans font-extrabold text-6xl text-lime-300">{submitResult.cefr_level}</p>
          <p className="mt-6 text-base text-white">
            You answered {submitResult.score} of {submitResult.total} correctly
          </p>

          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

          <button
            type="button"
            onClick={() => void finishAndOpenCourse()}
            className="mt-10 w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700"
          >
            Start your personalised course
          </button>
        </section>
      ) : null}
    </main>
  );
}
