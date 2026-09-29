"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PracticeNav from "../writing/task-nav";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const READING_SECONDS = 30;
const CHECKING_SECONDS = 30;

interface ListeningQuestion {
  id: string;
  number: number;
  type: "form_completion" | "multiple_choice";
  prompt: string;
  label: string;
  options?: { key: string; text: string }[];
  timestamp?: string;
}

interface ListeningTest {
  id: string;
  title: string;
  subtitle: string;
  section: number;
  instructions: string;
  audio_url: string;
  expected_duration_seconds: number;
  total_questions: number;
  questions: ListeningQuestion[];
}

interface QuestionFeedback {
  id: string;
  number: number;
  type: string;
  label: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  excerpt: string;
  timestamp?: string;
}

interface TranscriptLine {
  speaker: string;
  text: string;
}

interface GradeResponse {
  test_id: string;
  raw_score: number;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  band_score: number;
  feedback: QuestionFeedback[];
  transcript: TranscriptLine[];
  answer_lines: number[];
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

export default function ListeningPracticePage() {
  const [tests, setTests] = useState<ListeningTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  const selectedTest = useMemo(
    () => tests.find((t) => t.id === selectedTestId) ?? null,
    [tests, selectedTestId],
  );

  const totalSeconds = useMemo(() => {
    if (!selectedTest) return 0;
    return (
      READING_SECONDS +
      selectedTest.expected_duration_seconds +
      CHECKING_SECONDS
    );
  }, [selectedTest]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/listening/tests`);
        if (!res.ok) {
          throw new Error(`Failed to load tests (${res.status})`);
        }
        const data: { tests: ListeningTest[] } = await res.json();
        if (cancelled) return;
        setTests(data.tests);
        if (data.tests.length > 0) {
          const first = data.tests[0];
          setSelectedTestId(first.id);
          setTimeLeft(
            READING_SECONDS +
              first.expected_duration_seconds +
              CHECKING_SECONDS,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load listening tests. Is the backend running?",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const timeUp = timerRunning && timeLeft === 0;

  const resetTest = () => {
    setAnswers({});
    setResult(null);
    setError(null);
    setTimerRunning(false);
    if (selectedTest) {
      setTimeLeft(totalSeconds);
    }
  };

  const handleTestChange = (id: string) => {
    setSelectedTestId(id);
    setAnswers({});
    setResult(null);
    setError(null);
    setTimerRunning(false);
    const test = tests.find((t) => t.id === id);
    if (test) {
      setTimeLeft(
        READING_SECONDS + test.expected_duration_seconds + CHECKING_SECONDS,
      );
    }
  };

  const startTest = () => {
    setResult(null);
    setError(null);
    setTimeLeft(totalSeconds);
    setTimerRunning(true);
    audioRef.current?.play().catch(() => {});
  };

  const setAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v.trim().length > 0).length,
    [answers],
  );

  const handleSubmit = async () => {
    if (!selectedTest) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/listening/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_id: selectedTest.id, answers }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Grading failed (${res.status}): ${body}`);
      }
      const data: GradeResponse = await res.json();
      setResult(data);
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

  const audioSrc = useMemo(() => {
    if (!selectedTestId) return null;
    return `${API_BASE}/api/v1/listening/audio/${selectedTestId}?t=${Date.now()}`;
  }, [selectedTestId]);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
        <PracticeNav active="listening" />

        <header>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            IELTS Listening Practice
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Section 1 — listen to the recording once and answer the questions.
            Submit to get your raw score, band score, and a full answer key.
          </p>
        </header>

        {error && !selectedTest && (
          <div
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
          >
            {error}
          </div>
        )}

        {tests.length === 0 && !error && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Loading listening tests...
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Make sure the backend is running at {API_BASE}.
            </p>
          </div>
        )}

        {selectedTest && (
          <>
            <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {selectedTest.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {selectedTest.subtitle}
                  </p>
                  <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {selectedTest.instructions}
                  </p>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Test
                  <select
                    value={selectedTestId}
                    onChange={(e) => handleTestChange(e.target.value)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    {tests.map((test) => (
                      <option key={test.id} value={test.id}>
                        Section {test.section} — {test.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="flex flex-col gap-8 lg:flex-row lg:items-start">
              <div className="flex flex-1 flex-col gap-8">
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      Audio Recording
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {answeredCount}/{selectedTest.total_questions} answered
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
                    </div>
                  </div>

                  {audioSrc && (
                    <audio
                      ref={audioRef}
                      controls
                      src={audioSrc}
                      className="w-full"
                    />
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={startTest}
                      disabled={timerRunning && !timeUp}
                      className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-black"
                    >
                      {timerRunning && !timeUp
                        ? "Listening in progress..."
                        : "Start Test"}
                    </button>
                    <button
                      type="button"
                      onClick={resetTest}
                      disabled={loading}
                      className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Reset
                    </button>
                  </div>

                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    You have {READING_SECONDS} seconds to read the questions
                    before the recording, then {selectedTest.expected_duration_seconds} seconds
                    of audio, followed by {CHECKING_SECONDS} seconds to check your answers.
                    The recording is played only once.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    Questions 1-{selectedTest.total_questions}
                  </h3>
                  <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
                    Answer all questions. Spelling matters for the written
                    answers.
                  </p>

                  <div className="flex flex-col gap-5">
                    {selectedTest.questions.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-start gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          {q.number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {q.label}
                          </p>
                          {q.type === "multiple_choice" &&
                            q.options &&
                            q.options.length > 0 && (
                              <div className="mt-3 flex flex-col gap-2">
                                {q.options.map((opt) => {
                                  const checked = answers[q.id] === opt.key;
                                  return (
                                    <label
                                      key={opt.key}
                                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
                                        checked
                                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                                          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name={q.id}
                                        value={opt.key}
                                        checked={checked}
                                        onChange={() =>
                                          setAnswer(q.id, opt.key)
                                        }
                                        className="h-4 w-4 accent-indigo-600"
                                      />
                                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                                        {opt.key}.
                                      </span>
                                      <span className="text-zinc-700 dark:text-zinc-300">
                                        {opt.text}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          {q.type === "form_completion" && (
                            <input
                              type="text"
                              value={answers[q.id] ?? ""}
                              onChange={(e) => setAnswer(q.id, e.target.value)}
                              placeholder="Type your answer here..."
                              className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="flex w-full flex-col gap-4 lg:w-64">
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Exam Clock
                  </h3>
                  <p
                    className={`mt-3 font-mono text-5xl font-bold tabular-nums tracking-tight ${
                      timeUp
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-zinc-900 dark:text-zinc-50"
                    }`}
                  >
                    {formatTime(timeLeft)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {timeUp
                      ? "Time is up. Submit your answers."
                      : timerRunning
                        ? "Recording in progress — keep listening."
                        : result
                          ? "Test complete."
                          : "Press Start Test to begin the countdown."}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Answered
                  </h3>
                  <p className="mt-3 text-5xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                    {answeredCount}
                    <span className="text-2xl text-zinc-400">
                      /{selectedTest.total_questions}
                    </span>
                  </p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{
                        width: `${(answeredCount / selectedTest.total_questions) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </aside>
            </section>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || (!timerRunning && !result)}
                className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-black"
              >
                {loading ? "Grading..." : "Submit Test"}
              </button>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                You can submit any time after the recording finishes.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
              >
                {error}
              </div>
            )}

            {result && (
              <section className="flex flex-col gap-8">
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                  <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        IELTS Listening Band
                      </p>
                      <p
                        className={`mt-2 text-7xl font-bold tracking-tight ${bandColor(result.band_score)}`}
                      >
                        {result.band_score.toFixed(1)}
                      </p>
                    </div>
                    <div className="grid flex-1 grid-cols-1 gap-4 sm:max-w-xl sm:grid-cols-3">
                      <div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          Raw Score
                        </p>
                        <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {result.raw_score}
                          <span className="text-lg text-zinc-400">
                            /{result.total_questions}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          Correct
                        </p>
                        <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {result.correct_count}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          Incorrect
                        </p>
                        <p className="mt-1 text-3xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                          {result.incorrect_count}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                  <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    Answer Key Breakdown
                  </h3>
                  <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
                    See what you got right, the correct answer, and the exact
                    line from the recording that contains it.
                  </p>
                  <div className="flex flex-col gap-3">
                    {result.feedback.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-4 ${
                          item.is_correct
                            ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30"
                            : "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                                item.is_correct ? "bg-emerald-600" : "bg-rose-600"
                              }`}
                            >
                              {item.is_correct ? "✓" : "✗"}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                Question {item.number} — {item.label}
                              </p>
                              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                                Your answer:{" "}
                                <span
                                  className={
                                    item.is_correct
                                      ? "font-semibold text-emerald-700 dark:text-emerald-300"
                                      : "font-semibold text-rose-700 dark:text-rose-300"
                                  }
                                >
                                  {item.user_answer.trim() || "— (blank)"}
                                </span>
                                {!item.is_correct && (
                                  <>
                                    {" · "}Correct answer:{" "}
                                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                      {item.correct_answer}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                          {item.timestamp && (
                            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {item.timestamp}
                            </span>
                          )}
                        </div>
                        <p className="mt-3 border-t border-zinc-200 pt-3 text-sm italic leading-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                          “{item.excerpt}”
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                  <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    Transcript
                  </h3>
                  <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
                    The full recording. Highlighted lines contain the answers.
                  </p>
                  <div className="flex flex-col rounded-lg bg-zinc-50 dark:bg-zinc-950">
                    {result.transcript.map((line, index) => {
                      const isAnswerLine = result.answer_lines.includes(index);
                      return (
                        <div
                          key={index}
                          className={`flex gap-3 border-b border-zinc-100 px-4 py-2.5 text-sm leading-6 last:border-b-0 dark:border-zinc-900 ${
                            isAnswerLine
                              ? "bg-amber-50 dark:bg-amber-950/30"
                              : ""
                          }`}
                        >
                          <span
                            className={`w-16 shrink-0 font-semibold uppercase ${
                              isAnswerLine
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-zinc-500 dark:text-zinc-400"
                            }`}
                          >
                            {line.speaker}
                          </span>
                          <span className="text-zinc-800 dark:text-zinc-200">
                            {line.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
