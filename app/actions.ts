"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { authOptions, isAdminSession } from "@/lib/auth";
import { loadStore, saveStore, generateId } from "@/lib/store";
import { isMongoConfigured } from "@/lib/db";
import { extractScoreFromImage } from "@/lib/extract-score-from-screenshot";
import type { Round, ScoreEntry, GuessDetail } from "@/lib/store";
import { EVENT_POINTS } from "@/lib/scoreboard";

export type RoundWithTotals = Round & {
  playerTotals: { playerName: string; totalScore: number }[];
};

export type SubScoreEntry = {
  score: number;
  guessDetails?: GuessDetail[];
};

/** One game in an event: total game score + optional per-guess details. entryId needed for preview images when using MongoDB. */
export type GameEntry = SubScoreEntry & { entryId?: string };

export type RoundWithSubScores = Round & {
  entries: ScoreEntry[];
  playerTotals: { playerName: string; totalScore: number; subScores: number[]; subScoreEntries?: SubScoreEntry[] }[];
};

/** Player's participation in one event: the event, their games, and ranking/points. */
export type PlayerEvent = {
  event: Round;
  games: GameEntry[];
  /** This player's total score in this event (sum of game scores). */
  eventTotalScore: number;
  /** 1-based rank in this event (1 = first, 2 = second, …). */
  eventRank: number;
  /** Points earned in this event (3 for 1st, 2 for 2nd, 1 for 3rd, 0 otherwise). */
  eventPoints: number;
};

/** Player-centric scoreboard row: total event points (3/2/1 per event) and per-event breakdown. */
export type PlayerScoreboardEntry = {
  playerName: string;
  /** Sum of event points (3 for 1st, 2 for 2nd, 1 for 3rd in each event). */
  totalPoints: number;
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
    if (existing) {
      existing.totalScore += e.score;
      existing.subScores.push(e.score);
      existing.subScoreEntries.push(subEntry);
    } else {
      byPlayer.set(e.playerName, {
        totalScore: e.score,
        subScores: [e.score],
        subScoreEntries: [subEntry],
      });
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

/** Scoreboard ordered by player: total event points (3/2/1 per event), with events → games → guess details. */
export async function getScoreboardByPlayer(): Promise<PlayerScoreboardEntry[]> {
  const store = await loadStore();
  const roundsById = new Map(store.rounds.map((r) => [r.id, r]));

  const byPlayer = new Map<
    string,
    { byRound: Map<string, { games: GameEntry[]; totalScore: number }> }
  >();

  for (const e of store.scores) {
    const round = roundsById.get(e.roundId);
    if (!round) continue;

    let player = byPlayer.get(e.playerName);
    if (!player) {
      player = { byRound: new Map() };
      byPlayer.set(e.playerName, player);
    }
    const roundData = player.byRound.get(e.roundId) ?? {
      games: [],
      totalScore: 0,
    };
    const guessDetails =
      Array.isArray(e.guessDetails) && e.guessDetails.length > 0
        ? e.guessDetails
        : undefined;
    roundData.games.push({ score: e.score, guessDetails, entryId: e.id });
    roundData.totalScore += e.score;
    player.byRound.set(e.roundId, roundData);
  }

  const eventPointsMap = new Map<string, Map<string, number>>();
  for (const round of store.rounds) {
    const entries = store.scores.filter((s) => s.roundId === round.id);
    const totals = new Map<string, number>();
    for (const s of entries) {
      totals.set(s.playerName, (totals.get(s.playerName) ?? 0) + s.score);
    }
    const ranked = Array.from(totals.entries())
      .map(([playerName, totalScore]) => ({ playerName, totalScore }))
      .sort((a, b) => b.totalScore - a.totalScore);
    const pointsForRound = new Map<string, number>();
    ranked.forEach(({ playerName }, i) => {
      pointsForRound.set(playerName, EVENT_POINTS[i] ?? 0);
    });
    eventPointsMap.set(round.id, pointsForRound);
  }

  return Array.from(byPlayer.entries())
    .map(([playerName, { byRound }]) => {
      let totalPoints = 0;
      const events: PlayerEvent[] = Array.from(byRound.entries())
        .map(([roundId, { games, totalScore: eventTotalScore }]) => {
          const event = roundsById.get(roundId)!;
          const pointsForRound = eventPointsMap.get(roundId);
          const eventPoints = pointsForRound?.get(playerName) ?? 0;
          totalPoints += eventPoints;
          const entries = store.scores.filter((s) => s.roundId === roundId);
          const totals = new Map<string, number>();
          for (const s of entries) {
            totals.set(s.playerName, (totals.get(s.playerName) ?? 0) + s.score);
          }
          const ranked = Array.from(totals.entries())
            .sort((a, b) => b[1] - a[1])
            .map((r) => r[0]);
          const eventRank = ranked.indexOf(playerName) + 1 || 0;
          return {
            event,
            games,
            eventTotalScore,
            eventRank,
            eventPoints,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.event.date).getTime() - new Date(a.event.date).getTime()
        );
      return { playerName, totalPoints, events };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
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
  const useMongo = isMongoConfigured();
  let guessDetails: GuessDetail[] | undefined;
  if (result.guessDetails?.length) {
    if (useMongo) {
      guessDetails = result.guessDetails.map((g, i) => {
        const out: GuessDetail = {
          points: g.points,
          ...(g.yearsOff !== undefined && { yearsOff: g.yearsOff }),
          ...(g.distanceOff && { distanceOff: g.distanceOff }),
          imagePath: String(i),
          ...(g.imageData?.startsWith("data:image") && { imageData: g.imageData }),
        };
        return out;
      });
    } else {
      const previewsDir = path.join(process.cwd(), "data", "previews");
      const hasPreviews = result.guessDetails.some(
        (g) => g.imageData?.startsWith("data:image")
      );
      if (hasPreviews) {
        await mkdir(previewsDir, { recursive: true });
        await Promise.all(
          result.guessDetails.map(async (g, i) => {
            if (!g.imageData?.startsWith("data:image")) return;
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
        if (imageData?.startsWith("data:image"))
          out.imagePath = `${entryId}-${i}.jpg`;
        return out;
      });
    }
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
