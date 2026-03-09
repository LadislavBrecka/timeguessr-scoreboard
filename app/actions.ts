"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { authOptions, isAdminSession } from "@/lib/auth";
import { loadStore, saveStore, generateId } from "@/lib/store";
import { extractScoreFromImage } from "@/lib/extract-score-from-screenshot";
import type { Round, ScoreEntry, GuessDetail } from "@/lib/store";

export type RoundWithTotals = Round & {
  playerTotals: { playerName: string; totalScore: number }[];
};

export type SubScoreEntry = {
  score: number;
  guessDetails?: GuessDetail[];
};

export type RoundWithSubScores = Round & {
  entries: ScoreEntry[];
  playerTotals: { playerName: string; totalScore: number; subScores: number[]; subScoreEntries?: SubScoreEntry[] }[];
};

/** One game in an event: total game score + optional per-guess details. */
export type GameEntry = SubScoreEntry;

/** Player's participation in one event: the event + their games (scores) in it. */
export type PlayerEvent = {
  event: Round;
  games: GameEntry[];
};

/** Player-centric scoreboard row: total across all events, and per-event breakdown. */
export type PlayerScoreboardEntry = {
  playerName: string;
  totalScore: number;
  events: PlayerEvent[];
};

export async function getRoundsWithTotals(): Promise<RoundWithTotals[]> {
  const store = await loadStore();
  return store.rounds
    .slice()
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    .map((round) => {
      const roundScores = store.scores.filter((s) => s.roundId === round.id);
      const totals = new Map<string, number>();
      for (const s of roundScores) {
        totals.set(s.playerName, (totals.get(s.playerName) ?? 0) + s.score);
      }
      const playerTotals = Array.from(totals.entries())
        .map(([playerName, totalScore]) => ({ playerName, totalScore }))
        .sort((a, b) => b.totalScore - a.totalScore);
      return { ...round, playerTotals };
    });
}

export async function getRoundWithSubScores(
  roundId: string
): Promise<RoundWithSubScores | null> {
  const store = await loadStore();
  const round = store.rounds.find((r) => r.id === roundId);
  if (!round) return null;
  const entries = store.scores
    .filter((s) => s.roundId === roundId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  const byPlayer = new Map<
    string,
    { totalScore: number; subScores: number[]; subScoreEntries: SubScoreEntry[] }
  >();
  for (const e of entries) {
    const existing = byPlayer.get(e.playerName);
    const guessDetails =
      Array.isArray(e.guessDetails) && e.guessDetails.length > 0
        ? e.guessDetails
        : undefined;
    const subEntry: SubScoreEntry = {
      score: e.score,
      guessDetails,
    };
    if (!existing) {
      byPlayer.set(e.playerName, {
        totalScore: e.score,
        subScores: [e.score],
        subScoreEntries: [subEntry],
      });
    } else {
      existing.totalScore += e.score;
      existing.subScores.push(e.score);
      existing.subScoreEntries.push(subEntry);
    }
  }
  const playerTotals = Array.from(byPlayer.entries())
    .map(([playerName, { totalScore, subScores, subScoreEntries }]) => ({
      playerName,
      totalScore,
      subScores,
      subScoreEntries,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
  return { ...round, entries, playerTotals };
}

/** Scoreboard ordered by player: total score across all events, with events → games → guess details. */
export async function getScoreboardByPlayer(): Promise<PlayerScoreboardEntry[]> {
  const store = await loadStore();
  const roundsById = new Map(store.rounds.map((r) => [r.id, r]));

  const byPlayer = new Map<
    string,
    { totalScore: number; byRound: Map<string, GameEntry[]> }
  >();

  for (const e of store.scores) {
    const round = roundsById.get(e.roundId);
    if (!round) continue;

    let player = byPlayer.get(e.playerName);
    if (!player) {
      player = { totalScore: 0, byRound: new Map() };
      byPlayer.set(e.playerName, player);
    }
    player.totalScore += e.score;

    const guessDetails =
      Array.isArray(e.guessDetails) && e.guessDetails.length > 0
        ? e.guessDetails
        : undefined;
    const games = player.byRound.get(e.roundId) ?? [];
    games.push({ score: e.score, guessDetails });
    player.byRound.set(e.roundId, games);
  }

  return Array.from(byPlayer.entries())
    .map(([playerName, { totalScore, byRound }]) => {
      const events: PlayerEvent[] = Array.from(byRound.entries())
        .map(([roundId, games]) => {
          const event = roundsById.get(roundId)!;
          return { event, games };
        })
        .sort(
          (a, b) =>
            new Date(b.event.date).getTime() - new Date(a.event.date).getTime()
        );
      return { playerName, totalScore, events };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

export async function createRound(formData: FormData): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) {
    return { error: "Only an admin can create events. Please sign in." };
  }
  const name = (formData.get("name") as string)?.trim() || "New Social";
  const dateInput = formData.get("date") as string;
  const date = dateInput || new Date().toISOString().slice(0, 10);
  const store = await loadStore();
  const round: Round = {
    id: generateId(),
    name,
    date,
    createdAt: new Date().toISOString(),
  };
  store.rounds.push(round);
  await saveStore(store);
  revalidatePath("/");
  return {};
}

export async function deleteRound(roundId: string): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) {
    return { error: "Only an admin can delete events." };
  }
  const store = await loadStore();
  const roundIndex = store.rounds.findIndex((r) => r.id === roundId);
  if (roundIndex === -1) {
    return { error: "Event not found." };
  }
  store.rounds.splice(roundIndex, 1);
  store.scores = store.scores.filter((s) => s.roundId !== roundId);
  await saveStore(store);
  revalidatePath("/");
  return {};
}

export async function addScore(formData: FormData): Promise<{ error?: string }> {
  const roundId = formData.get("roundId") as string;
  const playerName = (formData.get("playerName") as string)?.trim();
  const scoreStr = formData.get("score") as string;
  if (!roundId || !playerName) {
    return { error: "Round and name are required." };
  }
  const score = Math.round(Number(scoreStr));
  if (Number.isNaN(score) || score < 0) {
    return { error: "Score must be a non-negative number." };
  }
  const store = await loadStore();
  if (!store.rounds.some((r) => r.id === roundId)) {
    return { error: "Round not found." };
  }
  const entry: ScoreEntry = {
    id: generateId(),
    roundId,
    playerName,
    score,
    createdAt: new Date().toISOString(),
  };
  store.scores.push(entry);
  await saveStore(store);
  revalidatePath("/");
  return {};
}

export async function addScoreFromScreenshot(
  formData: FormData
): Promise<{ error?: string; extractedScore?: number }> {
  const roundId = formData.get("roundId") as string;
  const playerName = (formData.get("playerName") as string)?.trim();
  const file = formData.get("screenshot") as File | null;
  if (!roundId || !playerName) {
    return { error: "Round and name are required." };
  }
  if (!file || file.size === 0) {
    return { error: "Please choose a screenshot image." };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/png";
  const result = await extractScoreFromImage(buffer, mimeType);
  if (!result.ok) {
    return { error: result.error };
  }
  const store = await loadStore();
  if (!store.rounds.some((r) => r.id === roundId)) {
    return { error: "Round not found." };
  }
  const entryId = generateId();
  const previewsDir = path.join(process.cwd(), "data", "previews");
  let guessDetails: GuessDetail[] | undefined;
  if (result.guessDetails?.length) {
    const hasPreviews = result.guessDetails.some(
      (g) => g.imageData && g.imageData.startsWith("data:image")
    );
    if (hasPreviews) {
      await mkdir(previewsDir, { recursive: true });
      await Promise.all(
        result.guessDetails.map(async (g, i) => {
          if (!g.imageData || !g.imageData.startsWith("data:image")) return;
          const base64 = g.imageData.replace(/^data:image\/\w+;base64,/, "");
          await writeFile(
            path.join(previewsDir, `${entryId}-${i}.jpg`),
            Buffer.from(base64, "base64")
          );
        })
      );
    }
    guessDetails = result.guessDetails.map((g, i) => {
      const { imageData, ...rest } = g;
      const out: GuessDetail = { ...rest };
      if (imageData && imageData.startsWith("data:image"))
        out.imagePath = `${entryId}-${i}.jpg`;
      return out;
    });
  }
  const entry: ScoreEntry = {
    id: entryId,
    roundId,
    playerName,
    score: result.totalScore,
    createdAt: new Date().toISOString(),
    guessDetails,
  };
  store.scores.push(entry);
  await saveStore(store);
  revalidatePath("/");
  return { extractedScore: result.totalScore };
}
