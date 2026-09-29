"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PracticeNav from "../writing/task-nav";

const RECORD_DURATION = 2 * 60;

const CUE_CARDS = [
  {
    id: "journey",
    title: "Describe a memorable journey you took",
    bullets: [
      "Where you went",
      "Who you were with",
      "What happened during the journey",
      "And explain why it was memorable",
    ],
  },
  {
    id: "friend",
    title: "Describe a friend you have known for a long time",
    bullets: [
      "Who this person is",
      "How long you have known them",
      "What you usually do together",
      "And explain why you value this friendship",
    ],
  },
  {
    id: "skill",
    title: "Describe a new skill you would like to learn",
    bullets: [
      "What the skill is",
      "Why you would like to learn it",
      "How you would learn it",
      "And explain whether it would be difficult to learn",
    ],
  },
  {
    id: "place",
    title: "Describe a place you would like to visit in the future",
    bullets: [
      "Where the place is",
      "How you know about it",
      "What you would do there",
      "And explain why you would like to visit it",
    ],
  },
] as const;

const CRITERIA = [
  { key: "fluency_and_coherence", label: "Fluency & Coherence" },
  { key: "lexical_resource", label: "Lexical Resource" },
  {
    key: "grammatical_range_and_accuracy",
    label: "Grammatical Range & Accuracy",
  },
  { key: "pronunciation", label: "Pronunciation" },
] as const;

interface SpeakingEvaluation {
  overall_band: number;
  criteria_scores: Record<(typeof CRITERIA)[number]["key"], number>;
  transcript: string;
  strengths: string[];
  key_improvements: string[];
  band_8_improved_transcript: string;
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

export default function SpeakingPracticePage() {
  const [activeCardId, setActiveCardId] = useState<string>(CUE_CARDS[0].id);
  const [recording, setRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(RECORD_DURATION);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpeakingEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  const activeCard =
    CUE_CARDS.find((c) => c.id === activeCardId) ?? CUE_CARDS[0];

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const interval = setInterval(() => {
      const remaining = RECORD_DURATION - Math.floor((Date.now() - started) / 1000);
      if (remaining <= 0) {
        stopRecording();
      }
      setTimeLeft(Math.max(0, remaining));
    }, 1000);
    return () => clearInterval(interval);
  }, [recording, stopRecording]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    setResult(null);
    setAudioBlob(null);
    setAudioUrl(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const candidates = ["audio/webm", "audio/mp4"];
      const mimeType =
        candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setDuration(
          Math.min(
            RECORD_DURATION,
            Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
          ),
        );
        stream.getTracks().forEach((t) => t.stop());
      };

      startedAtRef.current = Date.now();
      setTimeLeft(RECORD_DURATION);
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Microphone access denied. Please allow mic permission and try again.",
      );
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      setError("Please record your response before submitting.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const extension = audioBlob.type.includes("mp4") ? "m4a" : "webm";
      const formData = new FormData();
      formData.append("audio", audioBlob, `recording.${extension}`);
      formData.append("topic", activeCard.title);

      const res = await fetch(
        "http://127.0.0.1:8000/api/v1/evaluate-speaking",
        { method: "POST", body: formData },
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Evaluation failed (${res.status}): ${body}`);
      }

      const data: SpeakingEvaluation = await res.json();
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

  const clearAll = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setResult(null);
    setError(null);
    setTimeLeft(RECORD_DURATION);
  };

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
        <PracticeNav active="speaking" />

        <header>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            IELTS Speaking Practice
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Part 2 Cue Card — record up to 2 minutes of speech and get a Band 8
            evaluation against the official Speaking rubric.
          </p>
        </header>

        <section className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-8">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Cue Card
                </h2>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Topic
                  <select
                    value={activeCardId}
                    onChange={(e) => setActiveCardId(e.target.value)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    {CUE_CARDS.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="rounded-lg bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {activeCard.title}
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {activeCard.bullets.map((bullet, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
                    >
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Record Your Response
                </h2>
                <div className="flex items-center gap-3">
                  <span
                    className={`flex items-center gap-2 text-sm font-medium ${
                      recording
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {recording && (
                      <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                    )}
                    {recording ? "Recording" : "Idle"}
                  </span>
                  <span className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      timeLeft === 0
                        ? "font-semibold text-rose-600 dark:text-rose-400"
                        : recording
                          ? "text-zinc-900 dark:text-zinc-50"
                          : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={recording || loading}
                  className="rounded-full bg-rose-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-black"
                >
                  Start Recording
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  disabled={!recording}
                  className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Stop Recording
                </button>
              </div>

              {recording && (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  Speak clearly and keep going for the full 2 minutes. Recording
                  stops automatically when the timer reaches zero.
                </p>
              )}

              {!recording && audioUrl && (
                <div className="mt-5 rounded-lg bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
                  <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Recording captured ({duration} seconds) — play it back
                    before submitting:
                  </p>
                  <audio controls src={audioUrl} className="w-full" />
                </div>
              )}
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
                {recording
                  ? "You have 2 minutes for your cue card response."
                  : audioBlob
                    ? `You recorded ${duration} seconds of speech.`
                    : "The 2-minute timer starts when you begin recording."}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Band 8 Speaking
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Score against Fluency &amp; Coherence, Lexical Resource,
                Grammatical Range &amp; Accuracy, and Pronunciation.
              </p>
            </div>
          </aside>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!audioBlob || loading || recording}
            className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-black"
          >
            {loading ? "Evaluating..." : "Submit for Evaluation"}
          </button>
          {audioBlob && (
            <button
              type="button"
              onClick={clearAll}
              disabled={loading}
              className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
              Evaluating your speech...
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              A strict IELTS examiner is transcribing and scoring your response
              against the Band 8 descriptors.
            </p>
          </div>
        )}

        {result && (
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
                    const score = result.criteria_scores[criterion.key] ?? 0;
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
                  {result.strengths.map((strength, i) => (
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
                  {result.key_improvements.map((improvement, i) => (
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

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
              <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Your Transcript
              </h3>
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                The word-for-word transcription of your recorded response.
              </p>
              <div className="rounded-lg bg-zinc-50 px-5 py-4 text-sm leading-7 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                {result.transcript || "No speech detected."}
              </div>
            </div>

            {result.band_8_improved_transcript && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Band 8 Improved Transcript
                </h3>
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                  A rewritten version of your response at Band 8 standard,
                  covering the same cue card.
                </p>
                <div className="rounded-lg bg-zinc-50 px-5 py-4 text-sm leading-7 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  {result.band_8_improved_transcript}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
