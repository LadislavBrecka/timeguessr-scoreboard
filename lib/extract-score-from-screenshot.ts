/**
 * Uses OpenAI Vision API to extract the total game score and per-guess details
 * from a TimeGuessr results screenshot.
 * Requires OPENAI_API_KEY in the environment.
 */

import OpenAI from "openai";
import type { GuessDetail } from "./store";

export type ExtractResult =
  | { ok: true; totalScore: number; guessDetails?: GuessDetail[] }
  | { ok: false; error: string };

const SYSTEM_PROMPT = `You are extracting data from a TimeGuessr game results screenshot.

The image shows a score (e.g. "38,866 / 50,000" at the top) and a list of 5 guesses. Each guess may show:
- points (e.g. "6988 pts")
- optional "X yrs off" and distance (e.g. "444.6 m" or "5373.9 km")

Return a single JSON object with this exact shape (no markdown, no code fence):
{
  "totalScore": <number>,
  "guessDetails": [
    { "points": <number>, "yearsOff": <number or null>, "distanceOff": "<value> <unit>" or null },
    ... exactly 5 items, one per guess
  ]
}

Rules:
- totalScore: the main score at the top (before "/ 50,000"). Between 10000 and 50000.
- guessDetails: exactly 5 objects in order Guess 1 to Guess 5. Each: points (required, 0-10000), yearsOff (number or null), distanceOff (string or null). Use null for missing.`;

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
      max_tokens: 1024,
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

    const guessDetails: GuessDetail[] = [];
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
