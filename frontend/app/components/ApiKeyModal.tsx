"use client";

import { useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "custom_gemini_api_key";

let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  window.addEventListener("storage", listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

function getServerSnapshot(): string {
  return "";
}

function emitChange() {
  for (const listener of listeners) listener();
}

export default function ApiKeyModal() {
  const savedKey = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = useState(false);
  const [draftKey, setDraftKey] = useState<string | null>(null);

  const key = draftKey ?? savedKey;
  const isCustomKeySet = savedKey.length > 0;

  const handleSave = () => {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setDraftKey(null);
    emitChange();
    setIsOpen(false);
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDraftKey(null);
    emitChange();
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraftKey(savedKey);
          setIsOpen(true);
        }}
        className="flex shrink-0 items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isCustomKeySet ? "bg-emerald-500" : "bg-zinc-400"
          }`}
        />
        <span>{isCustomKeySet ? "Custom Key Set" : "Server Default Key"}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Gemini API Key Settings
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              By default, the server uses our shared free-tier key. If the daily
              quota is reached, paste your personal Google AI Studio key here. It
              is stored exclusively in your browser&apos;s local storage.
            </p>

            <input
              type="password"
              placeholder="AIzaSy..."
              value={key}
              onChange={(e) => setDraftKey(e.target.value)}
              className="mt-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-medium text-rose-600 underline hover:text-rose-500 dark:text-rose-400"
              >
                Use Default Key
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftKey(null);
                    setIsOpen(false);
                  }}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
                >
                  Save Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
