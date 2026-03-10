import { getDb } from "./db";
import type { Round, ScoreEntry, Store, User } from "./store";

/** User document in MongoDB (_id = username). */
type UserDocStored = { _id: string; passwordHash: string };

const ROUNDS = "rounds";
const SCORES = "scores";
const USERS = "users";

/** Round document in MongoDB (we use string _id). */
type RoundDoc = { _id: string; name: string; date: string; createdAt: string };

/** Score document as stored in MongoDB (_id, no id). */
type ScoreDocStored = {
  _id: string;
  roundId: string;
  playerName: string;
  score: number;
  createdAt: string;
  guessDetails?: Array<{
    points: number;
    yearsOff?: number;
    distanceOff?: string;
  }>;
};

function docToRound(doc: RoundDoc): Round {
  return {
    id: String(doc._id),
    name: doc.name,
    date: doc.date,
    createdAt: doc.createdAt,
  };
}

function docToScore(doc: ScoreDocStored): ScoreEntry {
  return {
    id: String(doc._id),
    roundId: doc.roundId,
    playerName: doc.playerName,
    score: doc.score,
    createdAt: doc.createdAt,
    guessDetails: doc.guessDetails?.length ? doc.guessDetails : undefined,
  };
}

function docToUser(doc: UserDocStored): User {
  return { username: doc._id, passwordHash: doc.passwordHash };
}

export async function loadStoreMongo(): Promise<Store> {
  const db = await getDb();
  const [roundsDocs, scoresDocs, usersDocs] = await Promise.all([
    db.collection<RoundDoc>(ROUNDS).find({}).toArray(),
    db.collection<ScoreDocStored>(SCORES).find({}).toArray(),
    db.collection<UserDocStored>(USERS).find({}).toArray(),
  ]);
  return {
    rounds: roundsDocs.map(docToRound),
    scores: scoresDocs.map(docToScore),
    users: usersDocs.map(docToUser),
  };
}

export async function saveStoreMongo(store: Store): Promise<void> {
  const db = await getDb();
  const roundsColl = db.collection<RoundDoc>(ROUNDS);
  const scoresColl = db.collection<ScoreDocStored>(SCORES);
  const usersColl = db.collection<UserDocStored>(USERS);
  await Promise.all([
    roundsColl.deleteMany({}),
    scoresColl.deleteMany({}),
    usersColl.deleteMany({}),
  ]);
  if (store.rounds.length > 0) {
    await roundsColl.insertMany(
      store.rounds.map((r) => ({
        _id: r.id,
        name: r.name,
        date: r.date,
        createdAt: r.createdAt,
      }))
    );
  }
  if (store.scores.length > 0) {
    await scoresColl.insertMany(
      store.scores.map((e) => ({
        _id: e.id,
        roundId: e.roundId,
        playerName: e.playerName,
        score: e.score,
        createdAt: e.createdAt,
        guessDetails: e.guessDetails,
      }))
    );
  }
  if (store.users.length > 0) {
    await usersColl.insertMany(
      store.users.map((u) => ({ _id: u.username, passwordHash: u.passwordHash }))
    );
  }
}
