import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { aiJobs, createDb } from "@bitshelf/db";
import { identifyItem, type IdentifyImage, type IdentifyMediaType } from "@bitshelf/api";
import { ensureUser, getRetroTechType } from "../../../lib/provision";

const MEDIA_TYPES = new Set<IdentifyMediaType>(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGES = 4;
// 2000px jpegs are well under this, guard against abuse
const MAX_BASE64_LENGTH = 8_000_000;

function parseImages(body: unknown): IdentifyImage[] | null {
  const images = (body as { images?: unknown })?.images;
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) {
    return null;
  }
  const out: IdentifyImage[] = [];
  for (const image of images) {
    const { base64, mediaType } = image as { base64?: unknown; mediaType?: unknown };
    if (
      typeof base64 !== "string" ||
      base64.length === 0 ||
      base64.length > MAX_BASE64_LENGTH ||
      !MEDIA_TYPES.has(mediaType as IdentifyMediaType)
    ) {
      return null;
    }
    out.push({ base64, mediaType: mediaType as IdentifyMediaType });
  }
  return out;
}

// POST { images: [{ base64, mediaType }] } -> { result, jobId, durationMs }
// One Claude call with all the photos and the seed's system prompt (spec 6.1).
// Every call is recorded as an AiJob for debugging and cost tracking (spec 4.9).
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const images = parseImages(body);
  if (!images) {
    return NextResponse.json({ error: "invalid_images" }, { status: 400 });
  }

  const db = createDb(process.env.DATABASE_URL ?? "");
  const user = await ensureUser(db, clerkId);
  const type = await getRetroTechType(db);

  try {
    const outcome = await identifyItem(images, type.aiSystemPrompt);
    const [job] = await db
      .insert(aiJobs)
      .values({
        userId: user.id,
        kind: "identify_item",
        model: outcome.model,
        input: { imageCount: images.length },
        rawOutput: outcome.result ?? { text: outcome.rawText },
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        costUsd: outcome.costUsd.toFixed(6),
        durationMs: outcome.durationMs,
        status: outcome.result ? "succeeded" : "failed",
        error: outcome.result ? null : "unparseable model output",
      })
      .returning({ id: aiJobs.id });

    if (!outcome.result) {
      return NextResponse.json({ error: "identify_failed", jobId: job?.id }, { status: 502 });
    }
    return NextResponse.json({
      result: outcome.result,
      jobId: job?.id,
      durationMs: outcome.durationMs,
    });
  } catch (err) {
    await db.insert(aiJobs).values({
      userId: user.id,
      kind: "identify_item",
      input: { imageCount: images.length },
      status: "failed",
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json({ error: "identify_failed" }, { status: 502 });
  }
}
