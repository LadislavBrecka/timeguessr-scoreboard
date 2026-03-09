import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

const PREVIEWS_DIR = path.join(process.cwd(), "data", "previews");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
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
