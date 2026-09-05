import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { aiJobs, createDb, modelReferences } from "@bitshelf/db";
import { generateModelReference } from "@bitshelf/api";
import { ensureUser, getRetroTechType } from "../../../lib/provision";

// generation with web search can take a while
export const maxDuration = 180;

interface Key {
  manufacturer: string;
  model: string;
  variant: string;
}

function parseKey(url: string): Key | null {
  const params = new URL(url).searchParams;
  const manufacturer = params.get("manufacturer")?.trim() ?? "";
  const model = params.get("model")?.trim() ?? "";
  const variant = params.get("variant")?.trim() ?? "";
  if (!manufacturer || !model || manufacturer.length > 80 || model.length > 120) {
    return null;
  }
  return { manufacturer, model, variant: variant.slice(0, 80) };
}

function shape(row: typeof modelReferences.$inferSelect) {
  return {
    manufacturer: row.manufacturer,
    model: row.model,
    variant: row.variant,
    releaseYear: row.releaseYear,
    discontinuedYear: row.discontinuedYear,
    summary: row.summary,
    specs: row.specs,
    links: row.links,
    tips: row.tips,
    knownVersions: row.knownVersions,
    generatedAt: row.generatedAt?.toISOString() ?? null,
  };
}

async function findExisting(db: ReturnType<typeof createDb>, key: Key) {
  return db.query.modelReferences.findFirst({
    where: and(
      eq(modelReferences.manufacturer, key.manufacturer),
      eq(modelReferences.model, key.model),
      eq(modelReferences.variant, key.variant),
    ),
  });
}

// GET ?manufacturer&model&variant -> { status: "ready", data } | { status: "missing" }
export async function GET(request: Request) {
  const key = parseKey(request.url);
  if (!key) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }
  const db = createDb(process.env.DATABASE_URL ?? "");
  const existing = await findExisting(db, key);
  // a variant-less fallback still answers "what is this model"
  const fallback =
    existing ?? (key.variant ? await findExisting(db, { ...key, variant: "" }) : undefined);
  if (!fallback) {
    return NextResponse.json({ status: "missing" });
  }
  return NextResponse.json({ status: "ready", data: shape(fallback) });
}

// POST { manufacturer, model, variant } -> generates when missing (spec 4.6.1),
// one shared record per model for all users. Requires sign-in, costs money.
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Key | null;
  const manufacturer = body?.manufacturer?.trim() ?? "";
  const model = body?.model?.trim() ?? "";
  const variant = body?.variant?.trim() ?? "";
  if (!manufacturer || !model || manufacturer.length > 80 || model.length > 120) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }
  const key: Key = { manufacturer, model, variant: variant.slice(0, 80) };

  const db = createDb(process.env.DATABASE_URL ?? "");
  const existing = await findExisting(db, key);
  if (existing) {
    return NextResponse.json({ status: "ready", data: shape(existing) });
  }

  const user = await ensureUser(db, clerkId);
  const type = await getRetroTechType(db);

  try {
    const outcome = await generateModelReference(key.manufacturer, key.model, key.variant);
    await db.insert(aiJobs).values({
      userId: user.id,
      kind: "model_reference",
      model: outcome.model,
      input: key,
      rawOutput: outcome.data ?? { text: outcome.rawText.slice(0, 4000) },
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      costUsd: outcome.costUsd.toFixed(6),
      durationMs: outcome.durationMs,
      status: outcome.data ? "succeeded" : "failed",
      error: outcome.data ? null : "unparseable model output",
    });
    if (!outcome.data) {
      return NextResponse.json({ error: "generation_failed" }, { status: 502 });
    }

    const [row] = await db
      .insert(modelReferences)
      .values({
        collectionTypeId: type.id,
        manufacturer: key.manufacturer,
        model: key.model,
        variant: key.variant,
        releaseYear: outcome.data.release_year ?? null,
        discontinuedYear: outcome.data.discontinued_year ?? null,
        summary: outcome.data.summary,
        specs: outcome.data.specs ?? {},
        links: outcome.data.links ?? [],
        tips: outcome.data.tips ?? {},
        knownVersions: outcome.data.known_versions ?? null,
        generatedAt: new Date(),
      })
      // two users saving the same model at once: first one wins
      .onConflictDoNothing()
      .returning();
    const saved = row ?? (await findExisting(db, key));
    return NextResponse.json({ status: "ready", data: saved ? shape(saved) : null });
  } catch (err) {
    await db.insert(aiJobs).values({
      userId: user.id,
      kind: "model_reference",
      input: key,
      status: "failed",
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }
}
