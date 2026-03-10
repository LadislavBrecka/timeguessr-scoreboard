"use client";

import { useState, useRef, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import {
  addScore,
  addScoreFromScreenshot,
  type RoundWithTotals,
  type PlayerScoreboardEntry,
} from "@/app/actions";
import type { GuessDetail } from "@/lib/store";

function isPlayerSession(session: { user?: { role?: string } } | null): boolean {
  return session?.user?.role === "player";
}

type Props = {
  initialRounds: RoundWithTotals[];
  initialPlayers: PlayerScoreboardEntry[];
  isAdmin: boolean;
};

export function Scoreboard({ initialRounds, initialPlayers, isAdmin }: Readonly<Props>) {
  const { data: session, status } = useSession();
  const isPlayer = isPlayerSession(session);
  const [rounds, setRounds] = useState<RoundWithTotals[]>(initialRounds);
  const [players, setPlayers] = useState<PlayerScoreboardEntry[]>(initialPlayers);
  const [expandedPlayerName, setExpandedPlayerName] = useState<string | null>(null);
  const [expandedGameKey, setExpandedGameKey] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"type" | "screenshot">("screenshot");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [addPending, setAddPending] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [howItWorksExpanded, setHowItWorksExpanded] = useState(true);

  const screenshotRoundRef = useRef<HTMLSelectElement>(null);
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
      if (!roundId) {
        setAddError("Select a round first.");
        return;
      }
      setAddError(null);
      setAddSuccess(null);
      const formData = new FormData();
      formData.set("roundId", roundId);
      formData.set("screenshot", file);
      submitScreenshotRef.current(formData);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addModalOpen, addMode]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-stone-200 pb-4 dark:border-stone-700">
        {status === "loading" ? (
          <span className="text-sm text-stone-500 dark:text-stone-400">Loading…</span>
        ) : session?.user ? (
          <>
            <span className="text-sm text-stone-600 dark:text-stone-300">
              Logged in as <strong>{session.user.name}</strong>
            </span>
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-stone-900 transition hover:bg-amber-400 dark:bg-stone-600 dark:text-stone-100 dark:hover:bg-stone-500"
              >
                Manage events
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-stone-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-600 dark:bg-stone-600 dark:hover:bg-stone-500"
            >
              Register
            </Link>
          </>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-stone-800 dark:text-stone-200">
          Scoreboard
        </h2>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/20">
              <button
                type="button"
                onClick={() => setHowItWorksExpanded((e) => !e)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-stone-700 transition hover:bg-amber-100/50 dark:text-stone-300 dark:hover:bg-amber-900/20"
                aria-expanded={howItWorksExpanded}
              >
                How it works
                <span className="shrink-0 text-stone-400 dark:text-stone-500" aria-hidden>
                  {howItWorksExpanded ? "▼" : "▶"}
                </span>
              </button>
              {howItWorksExpanded && (
                <div className="space-y-3 border-t border-amber-200/80 px-3 py-3 dark:border-amber-800/30">
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    <strong className="text-stone-700 dark:text-stone-300">Structure:</strong>{" "}
                    Each <strong>event</strong> has several <strong>games</strong> (as many as time allows at the social). Each game has guesses and produces a <strong>score</strong>.
                  </p>
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    <strong className="text-stone-700 dark:text-stone-300">Ranking:</strong>{" "}
                    Your event total is the <strong>sum of all your game scores</strong> in that event. Players are ranked by that sum. Based on ranking, they get event points assigned, according to this table:
                  </p>
                  <div className="space-y-1.5">
                    <span className="block rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">1st place → 3 pts</span>
                    <span className="block rounded bg-stone-200 px-2 py-1 text-xs font-semibold text-stone-700 dark:bg-stone-600 dark:text-stone-200">2nd place → 2 pts</span>
                    <span className="block rounded bg-amber-200/80 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">3rd place → 1 pt</span>
                    <span className="block rounded bg-stone-100 px-2 py-1 text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">4th and below → 0 pts</span>
                  </div>
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    The scoreboard shows <strong className="text-stone-700 dark:text-stone-300">total event points</strong> across all events. Click a player row to expand events, games, and guess details.
                  </p>
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    <strong className="text-stone-700 dark:text-stone-300">Adding scores:</strong>{" "}
                    Log in as a player to add your TimeGuessr scores (type them in or upload a screenshot).
                  </p>
                </div>
              )}
            </div>
          </div>
          {isPlayer ? (
            <button
              type="button"
              onClick={() => {
                setAddModalOpen(true);
                setAddError(null);
                setAddSuccess(null);
              }}
              disabled={rounds.length === 0}
              className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-amber-400 disabled:opacity-50"
            >
              + Add score
            </button>
          ) : session?.user ? (
            <p className="py-2 text-sm text-stone-500 dark:text-stone-400">
              You&apos;re logged in as admin.{" "}
              <Link href="/login" className="font-medium text-amber-600 underline hover:text-amber-700 dark:text-amber-400">
                Log in as a player
              </Link>
              {" to add your own scores."}
            </p>
          ) : (
            <p className="py-2 text-sm text-stone-500 dark:text-stone-400">
              <Link href="/login" className="font-medium text-amber-600 underline hover:text-amber-700 dark:text-amber-400">
                Log in
              </Link>
              {" or "}
              <Link href="/register" className="font-medium text-amber-600 underline hover:text-amber-700 dark:text-amber-400">
                register
              </Link>
              {" to add your score."}
            </p>
          )}
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
                {isAdmin ? (
                  <>No events yet. <Link href="/admin" className="font-medium text-amber-600 underline hover:text-amber-700 dark:text-amber-400">Create one in Admin</Link> first.</>
                ) : (
                  "An admin must create an event first."
                )}
              </p>
            )}
          </div>
        </div>
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
