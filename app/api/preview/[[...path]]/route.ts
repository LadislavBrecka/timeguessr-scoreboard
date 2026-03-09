import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import path from "node:path";
import { getDb, isMongoConfigured } from "@/lib/db";

const SCORES = "scores";
const PREVIEWS_DIR = path.join(process.cwd(), "data", "previews");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathSegments } = await params;
  const segments = pathSegments ?? [];

  // Two segments: entryId + index → fetch from MongoDB
  if (segments.length === 2) {
    const [entryId, indexStr] = segments;
    const index = parseInt(indexStr, 10);
    if (!entryId || Number.isNaN(index) || index < 0 || index > 9) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    if (!isMongoConfigured()) {
      return NextResponse.json({ error: "Not configured" }, { status: 404 });
    }
    const db = await getDb();
    type ScorePreviewDoc = { _id: string; guessDetails?: Array<{ imageData?: string }> };
    const doc = await db.collection<ScorePreviewDoc>(SCORES).findOne(
      { _id: entryId },
      { projection: { guessDetails: 1 } }
    );
    const imageData = doc?.guessDetails?.[index]?.imageData;
    if (!imageData || typeof imageData !== "string" || !imageData.startsWith("data:image")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(base64, "base64");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // One segment: filename → read from data/previews
  if (segments.length === 1) {
    const filename = segments[0];
    if (!filename || filename.includes("..") || path.isAbsolute(filename)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    const basename = path.basename(filename);
    if (basename !== filename) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    const filePath = path.join(PREVIEWS_DIR, basename);
    try {
      const buf = await readFile(filePath);
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
