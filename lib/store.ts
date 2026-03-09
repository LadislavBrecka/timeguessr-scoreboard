import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export type Round = {
  id: string;
  name: string;
  date: string; // ISO date of the social event
  createdAt: string;
};

/** Per-guess details extracted from a TimeGuessr screenshot (one game = 5 guesses). */
export type GuessDetail = {
  points: number;
  yearsOff?: number;
  distanceOff?: string; // e.g. "399.3 km" or "21.3 m"
  /** Filename for preview image in data/previews (e.g. "entryId-0.jpg"). */
  imagePath?: string;
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

export type Store = {
  rounds: Round[];
  scores: ScoreEntry[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const emptyStore: Store = { rounds: [], scores: [] };

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function loadStore(): Promise<Store> {
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw) as Store;
  } catch {
    return { ...emptyStore };
  }
}

export async function saveStore(store: Store): Promise<void> {
  await ensureDataDir();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
