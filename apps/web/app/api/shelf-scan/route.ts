import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { aiJobs, createDb } from "@bitshelf/db";
import {
  scanShelf,
  type IdentifyImage,
  type IdentifyMediaType,
} from "@bitshelf/api";
import { ensureUser } from "../../../lib/provision";

const MEDIA_TYPES = new Set<IdentifyMediaType>(["image/jpeg", "image/png", "image/webp"]);
// 2000px jpegs are well under this, guard against abuse
const MAX_BASE64_LENGTH = 8_000_000;

// a scan can take a while on Opus, keep the route from being cut short
export const maxDuration = 120;

function parseImage(body: unknown): IdentifyImage | null {
  const image = (body as { image?: unknown })?.image;
  const { base64, mediaType } = (image ?? {}) as { base64?: unknown; mediaType?: unknown };
  if (
    typeof base64 !== "string" ||
    base64.length === 0 ||
    base64.length > MAX_BASE64_LENGTH ||
    !MEDIA_TYPES.has(mediaType as IdentifyMediaType)
  ) {
    return null;
  }
  return { base64, mediaType: mediaType as IdentifyMediaType };
}

// POST { image: { base64, mediaType } } -> { items, jobId, durationMs }
// One Opus call per shelf photo (spec 6.3), recorded as an AiJob (spec 4.9).
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const image = parseImage(body);
  if (!image) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }

  const db = createDb(process.env.DATABASE_URL ?? "");
  const user = await ensureUser(db, clerkId);

  try {
    const outcome = await scanShelf(image);
    const [job] = await db
      .insert(aiJobs)
      .values({
        userId: user.id,
        kind: "shelf_scan",
        model: outcome.model,
        input: { imageCount: 1 },
        rawOutput: outcome.items ? { items: outcome.items } : { text: outcome.rawText },
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        costUsd: outcome.costUsd.toFixed(6),
        durationMs: outcome.durationMs,
        status: outcome.items ? "succeeded" : "failed",
        error: outcome.items ? null : "unparseable model output",
      })
      .returning({ id: aiJobs.id });

    if (!outcome.items) {
      return NextResponse.json({ error: "scan_failed", jobId: job?.id }, { status: 502 });
    }
    return NextResponse.json({
      items: outcome.items,
      jobId: job?.id,
      durationMs: outcome.durationMs,
    });
  } catch (err) {
    await db.insert(aiJobs).values({
      userId: user.id,
      kind: "shelf_scan",
      input: { imageCount: 1 },
      status: "failed",
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json({ error: "scan_failed" }, { status: 502 });
  }
}
