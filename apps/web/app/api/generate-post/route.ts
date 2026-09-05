import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { aiJobs, createDb } from "@bitshelf/db";
import { generatePost, type GeneratePostInput, type PostStyle } from "@bitshelf/api";
import { ensureUser } from "../../../lib/provision";

const STYLES = new Set<PostStyle>(["story", "sale", "question"]);

// POST { title, year?, condition?, workingStatus?, notes?, price?, style, language }
//   -> { text } (spec 8.2). Recorded as an AiJob.
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Partial<GeneratePostInput> | null;
  if (
    !body ||
    typeof body.title !== "string" ||
    body.title.length === 0 ||
    body.title.length > 200 ||
    !STYLES.has(body.style as PostStyle)
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const input: GeneratePostInput = {
    title: body.title,
    year: typeof body.year === "number" ? body.year : null,
    condition: typeof body.condition === "string" ? body.condition.slice(0, 10) : null,
    workingStatus:
      typeof body.workingStatus === "string" ? body.workingStatus.slice(0, 40) : null,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : null,
    price: typeof body.price === "string" ? body.price.slice(0, 40) : null,
    style: body.style as PostStyle,
    language: body.language === "en" ? "en" : "he",
  };

  const db = createDb(process.env.DATABASE_URL ?? "");
  const user = await ensureUser(db, clerkId);
  try {
    const outcome = await generatePost(input);
    await db.insert(aiJobs).values({
      userId: user.id,
      kind: "generate_post",
      model: outcome.model,
      input: { style: input.style, language: input.language },
      rawOutput: { text: outcome.text },
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      costUsd: outcome.costUsd.toFixed(6),
      durationMs: outcome.durationMs,
      status: outcome.text ? "succeeded" : "failed",
      error: outcome.text ? null : "empty model output",
    });
    if (!outcome.text) {
      return NextResponse.json({ error: "generation_failed" }, { status: 502 });
    }
    return NextResponse.json({ text: outcome.text });
  } catch (err) {
    await db.insert(aiJobs).values({
      userId: user.id,
      kind: "generate_post",
      input: { style: input.style, language: input.language },
      status: "failed",
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }
}
