import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { isMongoConfigured } from "./db";

export type Round = {
  id: string;
  name: string;
  date: string; // ISO date of the round
  createdAt: string;
};

/** Per-guess details extracted from a TimeGuessr screenshot (one game = 5 guesses). */
export type GuessDetail = {
  points: number;
  yearsOff?: number;
  distanceOff?: string; // e.g. "399.3 km" or "21.3 m"
};

export type ScoreEntry = {
  id: string;
  roundId: string;
  playerName: string;
  score: number;
  createdAt: string;
  /** Filled when added from screenshot; one entry per guess (typically 5). */
  guessDetails?: GuessDetail[];
};

export type User = {
  username: string;
  passwordHash: string;
};

export type Store = {
  rounds: Round[];
  scores: ScoreEntry[];
  users: User[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const emptyStore: Store = { rounds: [], scores: [], users: [] };

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function loadStore(): Promise<Store> {
  if (isMongoConfigured()) {
    try {
      const { loadStoreMongo } = await import("./store-mongo");
      return await loadStoreMongo();
    } catch {
      return { ...emptyStore };
    }
  }
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      rounds: parsed.rounds ?? [],
      scores: parsed.scores ?? [],
      users: parsed.users ?? [],
    };
  } catch {
    return { ...emptyStore };
  }
}

export async function saveStore(store: Store): Promise<void> {
  if (isMongoConfigured()) {
    const { saveStoreMongo } = await import("./store-mongo");
    await saveStoreMongo(store);
    return;
  }
  await ensureDataDir();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
