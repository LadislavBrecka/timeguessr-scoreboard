"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createRound, deleteRound, getRoundsWithTotals, type RoundWithTotals } from "@/app/actions";

type Props = {
  initialRounds: RoundWithTotals[];
};

export function AdminEvents({ initialRounds }: Readonly<Props>) {
  const [rounds, setRounds] = useState<RoundWithTotals[]>(initialRounds);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function refreshRounds() {
    const next = await getRoundsWithTotals();
    setRounds(next);
  }

  async function handleCreateRound(formData: FormData) {
    setCreateError(null);
    const result = await createRound(formData);
    if (result.error) {
      setCreateError(result.error);
      return;
    }
    setCreateModalOpen(false);
    await refreshRounds();
  }

  async function handleDeleteRound(roundId: string) {
    if (!confirm("Delete this event and all its scores? This cannot be undone.")) return;
    const result = await deleteRound(roundId);
    if (result.error) {
      setCreateError(result.error);
      return;
    }
    await refreshRounds();
  }

  useEffect(() => {
    if (createModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [createModalOpen]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
          Manage events
        </h1>
        <Link
          href="/"
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          ← Scoreboard
        </Link>
      </div>

      <section className="rounded-2xl border border-stone-300 bg-stone-50/80 p-6 shadow-sm dark:border-stone-600 dark:bg-stone-900/50">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200">
            Events
          </h2>
          <button
            type="button"
            onClick={() => {
              setCreateModalOpen(true);
              setCreateError(null);
            }}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-amber-400 dark:bg-stone-700 dark:text-stone-100 dark:hover:bg-stone-600"
          >
            + New event
          </button>
        </div>
        {rounds.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            No events yet. Click &quot;+ New event&quot; to create one.
          </p>
        ) : (
          <ul className="space-y-2">
            {rounds.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white py-2 pl-3 pr-2 dark:border-stone-600 dark:bg-stone-800"
              >
                <span className="min-w-0 flex-1 text-sm font-medium text-stone-800 dark:text-stone-200">
                  {r.name}
                </span>
                <span className="min-w-[7rem] shrink-0 text-right text-xs text-stone-500 dark:text-stone-400">
                  {new Date(r.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteRound(r.id)}
                  className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-event-title"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-stone-900/60 dark:bg-stone-950/70"
            onClick={() => {
              setCreateModalOpen(false);
              setCreateError(null);
            }}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-stone-300 bg-white p-6 shadow-xl dark:border-stone-600 dark:bg-stone-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="create-event-title" className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                New social event
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(false);
                  setCreateError(null);
                }}
                className="rounded p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form action={handleCreateRound} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-stone-600 dark:text-stone-400">Event name</span>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. March Social"
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-stone-600 dark:text-stone-400">Date</span>
                <input
                  type="date"
                  name="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                />
              </label>
              {createError && (
                <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-stone-700 px-4 py-2 font-medium text-white transition hover:bg-stone-600 dark:bg-stone-600 dark:hover:bg-stone-500"
                >
                  Create event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreateError(null);
                  }}
                  className="rounded-lg border border-stone-300 px-4 py-2 font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
