/**
 * Uses OpenAI Vision API to extract the total game score, per-guess details,
 * and per-guess preview image regions from a TimeGuessr results screenshot.
 * Requires OPENAI_API_KEY. Uses Sharp to crop preview thumbnails when regions are returned.
 */

import OpenAI from "openai";
import sharp from "sharp";
import type { GuessDetail } from "./store";

export type GuessDetailWithPreview = GuessDetail & { imageData?: string };

export type ExtractResult =
  | { ok: true; totalScore: number; guessDetails?: GuessDetailWithPreview[] }
  | { ok: false; error: string };

type PreviewRegion = { x: number; y: number; width: number; height: number };

const SYSTEM_PROMPT = `You are extracting data from a TimeGuessr game results screenshot.

The image shows a score (e.g. "38,866 / 50,000" at the top) and a list of 5 guesses. Each guess row typically has:
- a small preview/thumbnail image (the location or moment for that guess)
- points (e.g. "6988 pts")
- optional "X yrs off" and distance (e.g. "444.6 m" or "5373.9 km")

Return a single JSON object with this exact shape (no markdown, no code fence):
{
  "totalScore": <number>,
  "guessDetails": [
    { "points": <number>, "yearsOff": <number or null>, "distanceOff": "<value> <unit>" or null },
    ... exactly 5 items, one per guess
  ],
  "previewRegions": [
    { "x": <0-1>, "y": <0-1>, "width": <0-1>, "height": <0-1> },
    ... exactly 5 items, one per guess
  ]
}

Rules:
- totalScore: the main score at the top (before "/ 50,000"). Between 10000 and 50000.
- guessDetails: exactly 5 objects in order Guess 1 to Guess 5. Each: points (required, 0-10000), yearsOff (number or null), distanceOff (string or null). Use null for missing.
- previewRegions: exactly 5 objects. Each is the bounding box of that guess's preview/thumbnail image, as fractions of the full image (0 to 1). x,y = top-left; width,height = size. Order must match guess 1 to 5. If a preview is not clearly visible, use your best estimate.`;

export async function extractScoreFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return {
      ok: false,
      error:
        "OpenAI API key is missing. Add OPENAI_API_KEY to your .env file to use screenshot extraction.",
    };
  }

  const openai = new OpenAI({ apiKey });
  const base64 = imageBuffer.toString("base64");
  const mediaType = mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
  const dataUrl = `data:${mediaType};base64,${base64}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1536,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      return {
        ok: false,
        error: "OpenAI did not return any content. Try another screenshot.",
      };
    }

    const parsed = JSON.parse(raw) as {
      totalScore?: number;
      guessDetails?: Array<{
        points?: number;
        yearsOff?: number | null;
        distanceOff?: string | null;
      }>;
      previewRegions?: Array<{ x?: number; y?: number; width?: number; height?: number }>;
    };

    const totalScore = parsed.totalScore;
    if (
      typeof totalScore !== "number" ||
      Number.isNaN(totalScore) ||
      totalScore < 10_000 ||
      totalScore > 50_000
    ) {
      return {
        ok: false,
        error:
          "Could not read a valid score from the image. Make sure the screenshot shows the results screen (e.g. total like 40,643 / 50,000).",
      };
    }

    const guessDetails: GuessDetailWithPreview[] = [];
    const list = Array.isArray(parsed.guessDetails) ? parsed.guessDetails : [];
    for (let i = 0; i < Math.min(5, list.length); i++) {
      const g = list[i];
      const points =
        typeof g?.points === "number" && !Number.isNaN(g.points)
          ? Math.max(0, Math.min(10000, Math.round(g.points)))
          : undefined;
      if (points === undefined) continue;
      const yearsOff =
        g?.yearsOff != null && typeof g.yearsOff === "number" && !Number.isNaN(g.yearsOff)
          ? Math.max(0, Math.round(g.yearsOff))
          : undefined;
      const distanceOff =
        g?.distanceOff != null && typeof g.distanceOff === "string" && g.distanceOff.trim().length > 0
          ? g.distanceOff.trim()
          : undefined;
      guessDetails.push({
        points,
        ...(yearsOff !== undefined && { yearsOff }),
        ...(distanceOff !== undefined && { distanceOff }),
      });
    }

    // Crop preview thumbnails from screenshot using reported regions
    const regions = Array.isArray(parsed.previewRegions) ? parsed.previewRegions : [];
    if (guessDetails.length > 0 && regions.length >= guessDetails.length) {
      try {
        const meta = await sharp(imageBuffer).metadata();
        const imgW = meta.width ?? 0;
        const imgH = meta.height ?? 0;
        if (imgW > 0 && imgH > 0) {
          for (let i = 0; i < guessDetails.length && i < regions.length; i++) {
            const r = regions[i];
            const x = Math.max(0, Math.min(1, Number(r?.x) || 0));
            const y = Math.max(0, Math.min(1, Number(r?.y) || 0));
            const w = Math.max(0.01, Math.min(1 - x, Number(r?.width) || 0.1));
            const h = Math.max(0.01, Math.min(1 - y, Number(r?.height) || 0.1));
            const left = Math.floor(x * imgW);
            const top = Math.floor(y * imgH);
            const width = Math.max(1, Math.floor(w * imgW));
            const height = Math.max(1, Math.floor(h * imgH));
            const cropped = await sharp(imageBuffer)
              .extract({ left, top, width, height })
              .jpeg({ quality: 85 })
              .toBuffer();
            const b64 = cropped.toString("base64");
            guessDetails[i].imageData = `data:image/jpeg;base64,${b64}`;
          }
        }
      } catch {
        // ignore crop errors; guess details without previews are still valid
      }
    }

    return {
      ok: true,
      totalScore,
      guessDetails: guessDetails.length > 0 ? guessDetails : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("API key") || message.includes("401")) {
      return {
        ok: false,
        error:
          "Invalid OpenAI API key. Check OPENAI_API_KEY in your .env file.",
      };
    }
    if (message.includes("rate limit") || message.includes("429")) {
      return {
        ok: false,
        error: "OpenAI rate limit reached. Please try again in a moment.",
      };
    }
    return {
      ok: false,
      error: `Screenshot parsing failed: ${message}. You can add the score manually.`,
    };
  }
}
