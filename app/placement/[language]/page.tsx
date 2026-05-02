"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SUPPORTED_LANGUAGES } from "@/types";

const CEFR_SCALE: Array<"A1" | "A2" | "B1" | "B2" | "C1" | "C2"> = ["A1", "A2", "B1", "B2", "C1", "C2"];

type Stage = 1 | 2 | 3 | 4;

interface PlacementQuestionClient {
  id: string;
  type: "vocabulary" | "grammar" | "comprehension";
  cefr_level: string;
  topic_key?: string;
  prompt: string;
  context?: string;
  options: string[] | null;
  explanation?: string;
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

async function simulateCourseGeneration(): Promise<void> {
  await new Promise((r) => window.setTimeout(r, 800));
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

  const [testSessionId, setTestSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PlacementQuestionClient[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersById, setAnswersById] = useState<Record<string, string>>({});
  const [fillDraft, setFillDraft] = useState("");

  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    setFillDraft("");
  }, [currentIndex]);

  useEffect(() => {
    if (stage !== 2 && stage !== 3) {
      setExitConfirmOpen(false);
    }
  }, [stage]);

  const currentQuestion = questions[currentIndex] ?? null;
  const totalQuestions = questions.length;
  const progressPct = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  const canAdvance = useMemo(() => {
    if (!currentQuestion) return false;
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
      router.push("/dashboard");
    } finally {
      setSelfReportSubmitting(false);
    }
  }, [languageCode, languageName, router, selfReportLevel]);

  const skipAsBeginner = useCallback(async () => {
    setError("");
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?redirectedFrom=/placement/${languageCode}`);
      return;
    }

    const { error: learnErr } = await supabase.from("learning_languages").upsert(
      {
        user_id: user.id,
        language_code: languageCode,
        language_name: languageName,
        cefr_level: "A1",
        placement_completed: true
      },
      { onConflict: "user_id,language_code" }
    );
    if (learnErr) {
      setError(learnErr.message);
      return;
    }

    const { error: placeErr } = await supabase.from("placements").upsert(
      {
        user_id: user.id,
        language_code: languageCode,
        cefr_level: "A1",
        score: 0,
        total_questions: 0,
        weak_areas: [],
        skipped: true,
        completed_at: new Date().toISOString()
      },
      { onConflict: "user_id,language_code" }
    );
    if (placeErr) {
      setError(placeErr.message);
      return;
    }

    router.push(`/learn/${languageCode}`);
  }, [languageCode, languageName, router, supabase]);

  const selectOption = (option: string) => {
    if (!currentQuestion) return;
    setAnswersById((prev) => ({ ...prev, [currentQuestion.id]: option }));
  };

  const proceedAfterAnswering = useCallback(
    async (mergedAnswers: Record<string, string>) => {
      const isLast = currentIndex >= totalQuestions - 1;
      if (!isLast) {
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
    try {
      await simulateCourseGeneration();
    } catch {
      /* non-fatal */
    }
    router.push(`/learn/${languageCode}`);
  };

  if (!languageCode) {
    return (
      <main className="min-h-screen bg-[#F8FAF9] px-6 py-10">
        <p className="text-sm text-red-600">Invalid language.</p>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen bg-[#F8FAF9] px-5 pt-8 ${stage === 2 ? "pb-32" : "pb-28"}`}
    >
      {stage === 1 ? (
        <section className="mx-auto max-w-lg">
          <h1 className="font-serif text-3xl font-normal text-[#0F1A14]">Test your {languageName}</h1>
          <p className="mt-3 text-sm text-slate-600">
            10 questions to find your level. Takes about 2–3 minutes.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3">
            {CEFR_SCALE.map((level) => (
              <span
                key={level}
                className="min-w-[2.25rem] rounded-full border border-slate-200 bg-slate-50 py-2 text-center text-xs font-semibold text-slate-600"
              >
                {level}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">A1 through C2 — where will you land?</p>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          {introGenerating ? (
            <div className="mt-10 flex flex-col items-center rounded-2xl border border-slate-200 bg-white py-10">
              <div
                className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#2D6A4F]"
                aria-hidden
              />
              <p className="mt-4 text-sm font-medium text-slate-700">Generating your test…</p>
              <p className="mt-1 text-xs text-slate-500">This usually takes a few seconds</p>
            </div>
          ) : (
            <>
              <div className="mt-10 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => void startTest()}
                  className="w-full rounded-2xl bg-[#2D6A4F] py-4 text-base font-semibold text-white"
                >
                  Start placement test
                </button>
                <button
                  type="button"
                  onClick={() => void skipAsBeginner()}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white py-4 text-base font-semibold text-slate-700"
                >
                  I&apos;m a complete beginner
                </button>
              </div>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-widest text-slate-400">
                  <span className="bg-[#F8FAF9] px-3">or</span>
                </div>
              </div>

              <div>
                <p className="text-center text-sm font-medium text-slate-700">
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
                            ? "border-[#2D6A4F] bg-[#2D6A4F] text-white"
                            : "border-slate-200 text-slate-600"
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
                    className="mt-6 w-full rounded-2xl bg-[#2D6A4F] py-4 text-base font-semibold text-white disabled:opacity-50"
                  >
                    {selfReportSubmitting ? "Saving…" : "Confirm my level"}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </section>
      ) : null}

      {(stage === 2 && currentQuestion) || stage === 3 ? (
        <>
          <div className="sticky top-0 z-40 -mx-5 border-b border-slate-100 bg-[#F8FAF9] px-5 py-3">
            {exitConfirmOpen ? (
              <div className="mx-auto max-w-lg">
                <p className="text-center text-sm text-slate-700">
                  Exit test? Your progress will be lost.
                </p>
                <div className="mt-3 flex items-center justify-center gap-6">
                  <button
                    type="button"
                    onClick={() => setExitConfirmOpen(false)}
                    className="text-sm font-medium text-[#2D6A4F]"
                  >
                    Keep going
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="text-sm text-slate-400"
                  >
                    Exit
                  </button>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-lg items-center">
                <button
                  type="button"
                  onClick={() => setExitConfirmOpen(true)}
                  className="rounded-lg p-1 hover:bg-slate-100"
                  aria-label="Exit placement test"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>
            )}
          </div>

      {stage === 2 && currentQuestion ? (
        <>
        <section className="mx-auto max-w-lg">
          <div className="mb-6">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>
                Question {currentIndex + 1} of {totalQuestions}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-[#2D6A4F] transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            {generateWarning ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {generateWarning}
              </p>
            ) : null}
          </div>

          <h2 className="font-serif text-xl font-normal text-[#0F1A14]">{currentQuestion.prompt}</h2>

          {currentQuestion.context && currentQuestion.context.trim() ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
              {currentQuestion.context}
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
                    className={`w-full rounded-2xl border-2 py-4 px-4 text-left text-sm font-medium transition-colors ${
                      selected
                        ? "border-[#2D6A4F] bg-[#E8F5EE] text-[#0F1A14]"
                        : "border-slate-200 bg-white text-slate-700"
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
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[#0F1A14] outline-none ring-[#2D6A4F] focus:ring-2"
              />
            </div>
          )}

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </section>

        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => void goNext()}
              className="w-full rounded-2xl bg-[#2D6A4F] py-4 text-base font-semibold text-white disabled:opacity-50"
            >
              {currentIndex >= totalQuestions - 1 ? "Finish" : "Next"}
            </button>
            <button
              type="button"
              onClick={() => void handleDontKnow()}
              className="w-full cursor-pointer border-none bg-transparent py-1 text-center text-sm text-slate-400 underline"
            >
              I don&apos;t know
            </button>
          </div>
        </div>
        </>
      ) : null}

      {stage === 3 ? (
        <section className="mx-auto flex max-w-lg flex-col items-center py-20">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#2D6A4F]"
            aria-hidden
          />
          <p className="mt-6 font-medium text-slate-700">Analysing your results…</p>
          <p className="mt-1 animate-pulse text-sm text-slate-500">This may take a moment</p>
        </section>
      ) : null}

        </>
      ) : null}

      {stage === 4 && submitResult ? (
        <section className="mx-auto max-w-lg text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
            Your {languageName} level
          </p>
          <p className="mt-2 font-serif text-6xl font-normal text-[#2D6A4F]">{submitResult.cefr_level}</p>
          <p className="mt-6 text-base text-slate-700">
            You answered {submitResult.score} of {submitResult.total} correctly
          </p>

          {submitResult.weak_areas.length > 0 ? (
            <div className="mt-8">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Focus areas</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {submitResult.weak_areas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={() => void finishAndOpenCourse()}
            className="mt-10 w-full rounded-2xl bg-[#2D6A4F] py-4 text-base font-semibold text-white"
          >
            Start your personalised course
          </button>
        </section>
      ) : null}
    </main>
  );
}
