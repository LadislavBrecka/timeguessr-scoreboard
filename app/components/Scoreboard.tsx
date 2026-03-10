"use client";

import { useState, useRef, useEffect } from "react";
import { signIn, signOut } from "next-auth/react";
import {
  addScore,
  addScoreFromScreenshot,
  createRound,
  deleteRound,
  type RoundWithTotals,
  type PlayerScoreboardEntry,
} from "@/app/actions";
import type { GuessDetail } from "@/lib/store";

type Props = {
  initialRounds: RoundWithTotals[];
  initialPlayers: PlayerScoreboardEntry[];
  isAdmin: boolean;
};

export function Scoreboard({ initialRounds, initialPlayers, isAdmin }: Readonly<Props>) {
  const [rounds, setRounds] = useState<RoundWithTotals[]>(initialRounds);
  const [players, setPlayers] = useState<PlayerScoreboardEntry[]>(initialPlayers);
  const [expandedPlayerName, setExpandedPlayerName] = useState<string | null>(null);
  const [expandedGameKey, setExpandedGameKey] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"type" | "screenshot">("type");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [addPending, setAddPending] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const screenshotRoundRef = useRef<HTMLSelectElement>(null);
  const screenshotNameRef = useRef<HTMLInputElement>(null);
  const submitScreenshotRef = useRef<(formData: FormData) => Promise<void>>(
    () => Promise.resolve()
  );

  const currentRoundId = rounds[0]?.id ?? "";

  async function refreshData() {
    const [nextRounds, nextPlayers] = await Promise.all([
      import("@/app/actions").then((m) => m.getRoundsWithTotals()),
      import("@/app/actions").then((m) => m.getScoreboardByPlayer()),
    ]);
    setRounds(nextRounds);
    setPlayers(nextPlayers);
  }

  async function handleAddScore(formData: FormData) {
    setAddError(null);
    setAddSuccess(null);
    const result = await addScore(formData);
    if (result.error) {
      setAddError(result.error);
      return;
    }
    setAddSuccess("Score added.");
    setAddModalOpen(false);
    await refreshData();
  }

  async function handleAddScoreFromScreenshot(formData: FormData) {
    setAddError(null);
    setAddSuccess(null);
    setAddPending(true);
    try {
      const result = await addScoreFromScreenshot(formData);
      if (result.error) {
        setAddError(result.error);
        return;
      }
      setAddSuccess(
        result.extractedScore == null
          ? "Score added from screenshot."
          : `Score ${result.extractedScore.toLocaleString("en-GB")} added from screenshot.`
      );
      setAddModalOpen(false);
      await refreshData();
    } finally {
      setAddPending(false);
    }
  }
  submitScreenshotRef.current = handleAddScoreFromScreenshot;

  useEffect(() => {
    if (addModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [addModalOpen]);

  useEffect(() => {
    if (!addModalOpen || addMode !== "screenshot") return;
    function onPaste(e: ClipboardEvent) {
      const file = e.clipboardData?.files?.[0]
        ?? Array.from(e.clipboardData?.items ?? []).find(
            (item) => item.type.startsWith("image/")
          )?.getAsFile();
      if (!file?.type.startsWith("image/")) return;
      e.preventDefault();
      const roundId = screenshotRoundRef.current?.value;
      const playerName = screenshotNameRef.current?.value?.trim();
      if (!roundId || !playerName) {
        setAddError("Select a round and enter your name first.");
        return;
      }
      setAddError(null);
      setAddSuccess(null);
      const formData = new FormData();
      formData.set("roundId", roundId);
      formData.set("playerName", playerName);
      formData.set("screenshot", file);
      submitScreenshotRef.current(formData);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addModalOpen, addMode]);

  async function handleDeleteRound(roundId: string) {
    if (!confirm("Delete this event and all its scores? This cannot be undone.")) return;
    setCreateError(null);
    const result = await deleteRound(roundId);
    if (result.error) {
      setCreateError(result.error);
      return;
    }
    setExpandedGameKey(null);
    await refreshData();
  }

  async function handleCreateRound(formData: FormData) {
    setCreateError(null);
    const result = await createRound(formData);
    if (result.error) {
      setCreateError(result.error);
      return;
    }
    await refreshData();
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-stone-200 pb-4 dark:border-stone-700">
        {isAdmin ? (
          <>
            <span className="text-sm text-stone-500 dark:text-stone-400">
              Admin
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => signIn(undefined, { callbackUrl: "/" })}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Sign in (admin)
          </button>
        )}
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200">
              Scoreboard
            </h2>
            <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-400">
              Players by event points (1st = 3, 2nd = 2, 3rd = 1 per event). Expand to see events and games.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAddModalOpen(true);
              setAddError(null);
              setAddSuccess(null);
            }}
            disabled={rounds.length === 0}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-amber-400 disabled:opacity-50"
          >
            + Add score
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-sm dark:border-stone-600 dark:bg-stone-900">
          {players.length === 0 ? (
            <p className="rounded-xl border-0 border-dashed py-12 text-center text-stone-500 dark:text-stone-400">
              {isAdmin
                ? "No scores yet. Create an event below, then add scores."
                : "No scores yet. An admin must create an event first."}
            </p>
          ) : (
            <ul className="divide-y divide-stone-200 dark:divide-stone-700">
              {players.map((player, idx) => (
                <PlayerRow
                  key={player.playerName}
                  rank={idx + 1}
                  player={player}
                  isExpanded={expandedPlayerName === player.playerName}
                  expandedGameKey={expandedGameKey}
                  onToggleDetails={() =>
                    setExpandedPlayerName((p) =>
                      p === player.playerName ? null : player.playerName
                    )
                  }
                  onToggleGame={(key) =>
                    setExpandedGameKey((k) => (k === key ? null : key))
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-score-title"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-stone-900/60 dark:bg-stone-950/70"
            onClick={() => setAddModalOpen(false)}
          />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-300 bg-white p-6 shadow-xl dark:border-stone-600 dark:bg-stone-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="add-score-title" className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                Add score
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mb-4 flex gap-1 rounded-lg bg-stone-200/80 p-1 dark:bg-stone-700/50">
              <button
                type="button"
                onClick={() => {
                  setAddMode("type");
                  setAddError(null);
                  setAddSuccess(null);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  addMode === "type"
                    ? "bg-white text-stone-900 shadow dark:bg-stone-800 dark:text-stone-100"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
                }`}
              >
                Type score
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddMode("screenshot");
                  setAddError(null);
                  setAddSuccess(null);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  addMode === "screenshot"
                    ? "bg-white text-stone-900 shadow dark:bg-stone-800 dark:text-stone-100"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
                }`}
              >
                Upload screenshot
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              {addMode === "type" ? (
                <form
                  action={handleAddScore}
                  className="flex flex-wrap items-end gap-4"
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-stone-600 dark:text-stone-400">Round</span>
                    <select
                      name="roundId"
                      defaultValue={currentRoundId}
                      disabled={rounds.length === 0}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                    >
                      {rounds.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} — {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-stone-600 dark:text-stone-400">Name</span>
                    <input
                      type="text"
                      name="playerName"
                      required
                      placeholder="Your name"
                      className="min-w-[140px] rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-stone-600 dark:text-stone-400">Score</span>
                    <input
                      type="number"
                      name="score"
                      required
                      min={0}
                      step={1}
                      placeholder="0"
                      className="w-24 rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={rounds.length === 0}
                    className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-stone-900 transition hover:bg-amber-400 disabled:opacity-50"
                  >
                    Add score
                  </button>
                </form>
              ) : (
                <>
                  <form
                    action={handleAddScoreFromScreenshot}
                    className="flex flex-wrap items-end gap-4"
                  >
                    <label className="flex flex-col gap-1">
                      <span className="text-sm text-stone-600 dark:text-stone-400">Round</span>
                      <select
                        ref={screenshotRoundRef}
                        name="roundId"
                        defaultValue={currentRoundId}
                        disabled={rounds.length === 0}
                        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                      >
                        {rounds.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} — {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm text-stone-600 dark:text-stone-400">Name</span>
                      <input
                        ref={screenshotNameRef}
                        type="text"
                        name="playerName"
                        required
                        placeholder="Your name"
                        className="min-w-[140px] rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm text-stone-600 dark:text-stone-400">Screenshot</span>
                      <input
                        type="file"
                        name="screenshot"
                        accept="image/*"
                        required
                        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 file:mr-3 file:rounded file:border-0 file:bg-amber-100 file:px-3 file:py-1 file:text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:file:bg-amber-900/40 dark:file:text-stone-200"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={rounds.length === 0 || addPending}
                      className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-stone-900 transition hover:bg-amber-400 disabled:opacity-50"
                    >
                      {addPending ? "Reading…" : "Upload & add score"}
                    </button>
                  </form>
                  <p className="mt-2 w-full text-sm text-stone-500 dark:text-stone-400">
                    Or paste from clipboard (Ctrl+V / ⌘V). Use the TimeGuessr results screen.
                  </p>
                </>
              )}
            </div>
            {addError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{addError}</p>
            )}
            {addSuccess && (
              <p className="mt-3 text-sm text-green-700 dark:text-green-400">{addSuccess}</p>
            )}
            {rounds.length === 0 && (
              <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                {isAdmin ? "Create a round below first." : "An admin must create a round first."}
              </p>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <>
          <section className="rounded-2xl border border-stone-300 bg-stone-50/80 p-6 shadow-sm dark:border-stone-600 dark:bg-stone-900/50">
            <h2 className="mb-4 text-lg font-semibold text-stone-800 dark:text-stone-200">
              Events
            </h2>
            {rounds.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                No events yet. Create one below.
              </p>
            ) : (
              <ul className="space-y-2">
                {rounds.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white py-2 pl-3 pr-2 dark:border-stone-600 dark:bg-stone-800"
                  >
                    <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
                      {r.name}
                    </span>
                    <span className="text-xs text-stone-500 dark:text-stone-400">
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
          <section className="rounded-2xl border border-stone-300 bg-stone-50/80 p-6 shadow-sm dark:border-stone-600 dark:bg-stone-900/50">
            <h2 className="mb-4 text-lg font-semibold text-stone-800 dark:text-stone-200">
              New social event
            </h2>
            <form
            action={handleCreateRound}
            className="flex flex-wrap items-end gap-4"
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm text-stone-600 dark:text-stone-400">
                Event name
              </span>
              <input
                type="text"
                name="name"
                placeholder="e.g. March Social"
                className="min-w-[160px] rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-stone-600 dark:text-stone-400">
                Date
              </span>
              <input
                type="date"
                name="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-stone-700 px-4 py-2 font-medium text-white transition hover:bg-stone-600 dark:bg-stone-600 dark:hover:bg-stone-500"
            >
              Create round
            </button>
          </form>
          {createError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {createError}
            </p>
          )}
        </section>
        </>
      )}
    </div>
  );
}

function PlayerRow({
  rank,
  player,
  isExpanded,
  expandedGameKey,
  onToggleDetails,
  onToggleGame,
}: Readonly<{
  rank: number;
  player: PlayerScoreboardEntry;
  isExpanded: boolean;
  expandedGameKey: string | null;
  onToggleDetails: () => void;
  onToggleGame: (key: string) => void;
}>) {
  return (
    <li className="bg-white dark:bg-stone-900">
      <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
        <button
          type="button"
          onClick={onToggleDetails}
          className="flex flex-1 items-center justify-between gap-4 text-left transition hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-lg -mx-2 px-2 py-1"
        >
          <span className="w-6 text-sm text-stone-500 dark:text-stone-400">
            {rank}
          </span>
          <span className="font-semibold text-stone-900 dark:text-stone-100">
            {player.playerName}
          </span>
          <span className="text-stone-700 dark:text-stone-300 tabular-nums">
            {player.totalPoints} pts
          </span>
          <span
            className="text-stone-400 dark:text-stone-500"
            aria-hidden
          >
            {isExpanded ? "▼" : "▶"}
          </span>
        </button>
      </div>
      {isExpanded && (
        <div className="border-t border-amber-200 bg-amber-50/30 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Events
          </p>
          <div className="space-y-4">
            {player.events.map(({ event, games, eventTotalScore, eventRank, eventPoints }) => {
              const eventDateStr = new Date(event.date).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const rankLabel = eventRank === 1 ? "1st" : eventRank === 2 ? "2nd" : eventRank === 3 ? "3rd" : `${eventRank}th`;
              const rankBadgeClass =
                eventRank === 1
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                  : eventRank === 2
                    ? "bg-stone-200 text-stone-700 dark:bg-stone-600 dark:text-stone-200"
                    : eventRank === 3
                      ? "bg-amber-200/80 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                      : "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300";
              return (
                <div
                  key={event.id}
                  className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800/50"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
                      {event.name}
                    </p>
                    {eventRank > 0 && (
                      <>
                        <span
                          className={`inline-flex shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${rankBadgeClass}`}
                          aria-label={`Placed ${rankLabel}`}
                        >
                          {rankLabel}
                        </span>
                        {eventPoints > 0 && (
                          <span
                            className="inline-flex shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                            aria-label={`+${eventPoints} points`}
                          >
                            +{eventPoints} pts
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
                    {eventDateStr} · Event total:{" "}
                    {eventTotalScore.toLocaleString("en-GB")} pts
                  </p>
                  <p className="mb-1.5 text-xs font-medium text-stone-600 dark:text-stone-400">
                    Games
                  </p>
                  <div className="space-y-2">
                    {games.map((game, gameIdx) => {
                      const gameKey = `${player.playerName}-${event.id}-${gameIdx}`;
                      const gameExpanded = expandedGameKey === gameKey;
                      const hasDetails =
                        Array.isArray(game.guessDetails) && game.guessDetails.length > 0;
                      return (
                        <div
                          key={gameIdx}
                          className="rounded border border-stone-200 dark:border-stone-600"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              hasDetails ? onToggleGame(gameKey) : undefined
                            }
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                              hasDetails
                                ? "cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50"
                                : "cursor-default"
                            }`}
                          >
                            <span className="text-stone-700 dark:text-stone-300">
                              Game {gameIdx + 1}: {game.score.toLocaleString("en-GB")} pts
                            </span>
                            {hasDetails && (
                              <span className="text-stone-400 dark:text-stone-500">
                                {gameExpanded ? "▼" : "▶"}
                              </span>
                            )}
                          </button>
                          {gameExpanded && hasDetails && game.guessDetails && (
                            <div className="border-t border-stone-200 bg-stone-50/50 px-3 py-2 dark:border-stone-700 dark:bg-stone-800/50">
                              <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
                                Guesses
                              </p>
                              <ul className="space-y-1 text-xs text-stone-600 dark:text-stone-400">
                                {game.guessDetails.map((g: GuessDetail, gi: number) => (
                                  <li key={gi}>
                                    Guess {gi + 1}: {g.points} pts
                                    {g.yearsOff != null && ` · ${g.yearsOff} yrs off`}
                                    {g.distanceOff && ` · ${g.distanceOff}`}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </li>
  );
}
