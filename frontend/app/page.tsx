"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function Home() {
  const [writingOpen, setWritingOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking anywhere outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setWritingOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const modules = [
    {
      title: "Writing Task 1",
      tag: "Academic",
      description: "Analyze charts, graphs, tables, and process diagrams with criteria-based feedback.",
      href: "/writing/task1",
      badge: "Visual Reports",
    },
    {
      title: "Writing Task 2",
      tag: "Essay",
      description: "Full essay evaluation across Task Response, Coherence, Lexical Resource, and Grammar.",
      href: "/writing",
      badge: "Band 8 Scorer",
    },
    {
      title: "Speaking Practice",
      tag: "Audio & Fluency",
      description: "Record answers, generate automated speech transcripts, and review Band 8 rewrites.",
      href: "/speaking",
      badge: "Voice & Pronunciation",
    },
    {
      title: "Listening Test",
      tag: "Section Test",
      description: "Simulated audio dialogues with real-time questions and timestamped transcript review.",
      href: "/listening",
      badge: "Multi-voice Audio",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar with Writing Dropdown */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-sm font-extrabold">IELTS</span>
            <span>Band 8 Platform</span>
          </Link>

          <nav className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-3 py-1.5 shadow-sm text-sm">
            <span className="pl-3 pr-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Practice:
            </span>

            {/* Writing Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setWritingOpen((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition"
              >
                <span>Writing</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    writingOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {writingOpen && (
                <div className="absolute top-full left-0 mt-2 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 flex flex-col">
                  <Link
                    href="/writing/task1"
                    onClick={() => setWritingOpen(false)}
                    className="px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-indigo-400 transition"
                  >
                    Task 1 (Charts & Reports)
                  </Link>
                  <Link
                    href="/writing"
                    onClick={() => setWritingOpen(false)}
                    className="px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-indigo-400 transition"
                  >
                    Task 2 (Essay)
                  </Link>
                </div>
              )}
            </div>

            {/* Speaking Link */}
            <Link
              href="/speaking"
              className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition"
            >
              Speaking
            </Link>

            {/* Listening Link */}
            <Link
              href="/listening"
              className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition"
            >
              Listening
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6 text-center max-w-4xl mx-auto flex-1">
        <span className="inline-block py-1 px-3 mb-6 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          AI Preparation System
        </span>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
          Target Band 8.0 & Above <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
            With Instant AI Evaluation
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Calibrated feedback on essays, spoken recordings, and listening tests built specifically on official IELTS band descriptors.
        </p>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left mt-8">
          {modules.map((m) => (
            <Link
              key={m.title}
              href={m.href}
              className="group rounded-2xl bg-slate-900/60 border border-slate-800 p-6 hover:border-indigo-500/50 hover:bg-slate-900 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {m.tag}
                  </span>
                  <span className="text-xs text-indigo-400 font-medium">{m.badge}</span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors mb-2">
                  {m.title}
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">{m.description}</p>
              </div>
              <div className="text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
                Open Section &rarr;
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 text-center text-xs text-slate-500">
        IELTS Practice Platform &copy; 2026. Built with Next.js, FastAPI, and Google Gemini.
      </footer>
    </div>
  );
}