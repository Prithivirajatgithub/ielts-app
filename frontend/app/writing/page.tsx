"use client";

import { useEffect, useMemo, useState } from "react";

const EXAM_DURATION = 40 * 60;

const PROMPTS = [
  {
    id: "community-service",
    text: "Some people believe that unpaid community service should be a compulsory part of high school programmes. To what extent do you agree or disagree?",
  },
  {
    id: "longer-life",
    text: "In many countries, people are living longer than ever before. Some people think this has benefits for society, while others believe it creates significant problems. Discuss both views and give your own opinion.",
  },
  {
    id: "crime",
    text: "Some people think that the best way to reduce crime is to impose longer prison sentences, while others believe there are better alternatives. Discuss both views and give your opinion.",
  },
  {
    id: "technology",
    text: "Nowadays, technology is increasingly used to monitor what people are saying and doing (for example, through mobile phones and CCTV). Is this a positive or negative development?",
  },
  {
    id: "custom",
    text: "",
  },
];

const CRITERIA = [
  { key: "task_response", label: "Task Response" },
  { key: "coherence_and_cohesion", label: "Coherence & Cohesion" },
  { key: "lexical_resource", label: "Lexical Resource" },
  { key: "grammatical_range_and_accuracy", label: "Grammatical Accuracy" },
] as const;

interface EssayEvaluation {
  task_response: number;
  coherence_and_cohesion: number;
  lexical_resource: number;
  grammatical_range_and_accuracy: number;
  overall_band: number;
  feedback: string;
}

interface ParsedFeedback {
  strengths: string[];
  improvements: string[];
  rewrite: string;
}

function parseFeedback(feedback: string): ParsedFeedback {
  const strengthsMatch = feedback.match(
    /Strengths:\s*([\s\S]*?)(?=\n\s*Key improvements:|$)/,
  );
  const improvementsMatch = feedback.match(
    /Key improvements:\s*([\s\S]*?)(?=\n\s*Band 8 rewrite:|$)/,
  );
  const rewriteMatch = feedback.match(/Band 8 rewrite:\s*([\s\S]*)$/);

  const parseList = (raw?: string) =>
    (raw ?? "")
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);

  return {
    strengths: parseList(strengthsMatch?.[1]),
    improvements: parseList(improvementsMatch?.[1]),
    rewrite: (rewriteMatch?.[1] ?? "").trim(),
  };
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function bandColor(score: number) {
  if (score >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 7) return "text-lime-600 dark:text-lime-400";
  if (score >= 6) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function barColor(score: number) {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 7) return "bg-lime-500";
  if (score >= 6) return "bg-amber-500";
  return "bg-rose-500";
}

export default function WritingPracticePage() {
  const [selectedPrompt, setSelectedPrompt] = useState(PROMPTS[0].id);
  const [customPrompt, setCustomPrompt] = useState("");
  const [essay, setEssay] = useState("");
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION);
  const [timerRunning, setTimerRunning] = useState(false);
  const [result, setResult] = useState<EssayEvaluation | null>(null);
  const [parsed, setParsed] = useState<ParsedFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prompt = useMemo(() => {
    const selected = PROMPTS.find((p) => p.id === selectedPrompt);
    return selected?.id === "custom" ? customPrompt : selected?.text ?? "";
  }, [selectedPrompt, customPrompt]);

  const wordCount = useMemo(
    () => (essay.trim() ? essay.trim().split(/\s+/).length : 0),
    [essay],
  );

  const timeUp = timeLeft === 0;

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const handleEssayChange = (value: string) => {
    setEssay(value);
    if (!timerRunning && !timeUp) setTimerRunning(true);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimeLeft(EXAM_DURATION);
  };

  const clearAll = () => {
    setEssay("");
    setResult(null);
    setParsed(null);
    setError(null);
    resetTimer();
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError("Please choose a prompt or enter your own essay question.");
      return;
    }
    if (essay.trim().split(/\s+/).length < 50) {
      setError("Please write at least 50 words before submitting.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setParsed(null);

    try {
      const res = await fetch("http://localhost:8000/api/v1/evaluate-essay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, essay }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Evaluation failed (${res.status}): ${body}`);
      }

      const data: EssayEvaluation = await res.json();
      setResult(data);
      setParsed(parseFeedback(data.feedback));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            IELTS Writing Practice
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Task 2 Essay — type your response, keep an eye on the clock, and
            submit for a Band 8 evaluation.
          </p>
        </header>

        <section className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-8">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Essay Prompt
              </h2>
              <label
                htmlFor="prompt-select"
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Choose a Task 2 prompt
              </label>
              <select
                id="prompt-select"
                value={selectedPrompt}
                onChange={(e) => setSelectedPrompt(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                {PROMPTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === "custom"
                      ? "Enter your own prompt..."
                      : `Prompt ${PROMPTS.indexOf(p) + 1}`}
                  </option>
                ))}
              </select>

              {selectedPrompt === "custom" ? (
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Type or paste your own IELTS Task 2 essay question here..."
                  rows={3}
                  className="mt-4 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              ) : (
                <div className="mt-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  {prompt}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Your Response
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {wordCount} words
                  </span>
                  <span className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      timeUp
                        ? "font-semibold text-rose-600 dark:text-rose-400"
                        : timerRunning
                          ? "text-zinc-900 dark:text-zinc-50"
                          : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {timeUp ? "Time's up!" : formatTime(timeLeft)}
                  </span>
                  {!timeUp && (
                    <button
                      type="button"
                      onClick={resetTimer}
                      className="text-xs font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={essay}
                onChange={(e) => handleEssayChange(e.target.value)}
                placeholder="Write your essay here. Aim for 250-300 words in 40 minutes..."
                rows={16}
                className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
          </div>

          <aside className="flex w-full flex-col gap-4 lg:w-64">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Exam Clock
              </h3>
              <p className="mt-3 font-mono text-5xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                {formatTime(timeLeft)}
              </p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {timerRunning
                  ? "Timer running — keep writing."
                  : timeUp
                    ? "Time is up. Submit what you have."
                    : "The timer starts when you begin typing."}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Word Count
              </h3>
              <p className="mt-3 text-5xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                {wordCount}
              </p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {wordCount < 250
                  ? `${250 - wordCount} more words to reach the 250 minimum.`
                  : "Great — you've hit the 250-word minimum."}
              </p>
            </div>
          </aside>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-black"
          >
            {loading
              ? "Evaluating..."
              : "Submit for Band 8 Evaluation"}
          </button>
          {result && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Start Over
            </button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
          >
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Evaluating your essay...
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              A strict IELTS examiner is scoring your response against the Band
              8 descriptors.
            </p>
          </div>
        )}

        {result && parsed && (
          <section className="flex flex-col gap-8">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
              <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Overall Band Score
                  </p>
                  <p
                    className={`mt-2 text-7xl font-bold tracking-tight ${bandColor(result.overall_band)}`}
                  >
                    {result.overall_band.toFixed(1)}
                  </p>
                </div>
                <div className="grid flex-1 grid-cols-1 gap-4 sm:max-w-xl sm:grid-cols-2">
                  {CRITERIA.map((criterion) => {
                    const score = result[criterion.key];
                    return (
                      <div key={criterion.key}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {criterion.label}
                          </span>
                          <span
                            className={`text-sm font-semibold tabular-nums ${bandColor(score)}`}
                          >
                            {score.toFixed(1)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                          <div
                            className={`h-full rounded-full ${barColor(score)}`}
                            style={{ width: `${(score / 9) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 dark:border-emerald-900 dark:bg-emerald-950/40">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-emerald-900 dark:text-emerald-300">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                    +
                  </span>
                  Key Strengths
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {parsed.strengths.map((strength, i) => (
                    <li
                      key={i}
                      className="text-sm leading-6 text-emerald-900/90 dark:text-emerald-100/90"
                    >
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 dark:border-amber-900 dark:bg-amber-950/40">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-amber-900 dark:text-amber-300">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                    →
                  </span>
                  Key Improvements
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {parsed.improvements.map((improvement, i) => (
                    <li
                      key={i}
                      className="text-sm leading-6 text-amber-900/90 dark:text-amber-100/90"
                    >
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {parsed.rewrite && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Band 8 Sample Rewrite
                </h3>
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                  A rewritten version of your essay at Band 8 standard, keeping
                  your position on the topic.
                </p>
                <div className="rounded-lg bg-zinc-50 px-5 py-4 text-sm leading-7 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  {parsed.rewrite.split("\n").map((paragraph, i) =>
                    paragraph.trim() ? (
                      <p key={i} className="mb-4 last:mb-0">
                        {paragraph}
                      </p>
                    ) : null,
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
