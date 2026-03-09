import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "timeguessr";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClient: Promise<MongoClient> | undefined;
}

function getClient(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (globalThis.__mongoClient) return globalThis.__mongoClient;
  const promise = new MongoClient(uri).connect();
  if (process.env.NODE_ENV === "development") globalThis.__mongoClient = promise;
  return promise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(dbName);
}

export function isMongoConfigured(): boolean {
  return Boolean(uri?.trim());
}
