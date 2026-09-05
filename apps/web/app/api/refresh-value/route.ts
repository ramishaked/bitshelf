import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, gte } from "drizzle-orm";
import { createDb, items, priceObservations } from "@bitshelf/db";
import { computeValue, ebayConfigured, searchAskingPrices } from "@bitshelf/api";
import { ensureUser } from "../../../lib/provision";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST { itemId } -> { low, fair, high, confidence, askingCount, soldCount }
// "Update value" (spec 9): pull up to 20 asking prices from eBay Browse,
// store them as PriceObservations, recompute the three points and save
// them on the item. USD asking prices are stored as-is in USD.
export async function POST(request: Request) {
  if (!ebayConfigured()) {
    return NextResponse.json({ error: "ebay_not_configured" }, { status: 503 });
  }
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { itemId?: string } | null;
  const itemId = body?.itemId;
  if (typeof itemId !== "string" || !UUID_RE.test(itemId)) {
    return NextResponse.json({ error: "invalid_item" }, { status: 400 });
  }

  const db = createDb(process.env.DATABASE_URL ?? "");
  const user = await ensureUser(db, clerkId);
  const item = await db.query.items.findFirst({
    where: and(eq(items.id, itemId), eq(items.ownerId, user.id)),
  });
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const a = item.attributes as Record<string, unknown>;
  const query = [a.manufacturer, a.model, a.variant]
    .filter((v): v is string => typeof v === "string" && v !== "")
    .join(" ");
  if (!query) {
    return NextResponse.json({ error: "no_identity" }, { status: 400 });
  }

  try {
    const listings = await searchAskingPrices(query, 20);
    if (listings.length > 0) {
      await db.insert(priceObservations).values(
        listings.map((l) => ({
          itemId: item.id,
          manufacturer: (a.manufacturer as string) ?? null,
          model: (a.model as string) ?? null,
          source: "ebay_active" as const,
          price: l.price.toFixed(2),
          currency: (l.currency === "USD" ? "USD" : "USD") as "USD",
          url: l.url,
          conditionHint: l.title.slice(0, 200),
        })),
      );
    }

    // recompute from everything relevant in the table (manual rows included)
    const cutoff = new Date(Date.now() - 200 * 86_400_000);
    const rows = await db
      .select()
      .from(priceObservations)
      .where(
        and(eq(priceObservations.itemId, item.id), gte(priceObservations.observedAt, cutoff)),
      );
    const result = computeValue(
      rows.map((r) => ({
        price: Number(r.price),
        source: r.source,
        observedAt: r.observedAt,
      })),
      {
        workingStatus: (a.working_status as string) ?? null,
        completeness: (a.completeness as string) ?? null,
        conditionGrade: item.conditionGrade,
      },
    );
    if (!result) {
      return NextResponse.json({ error: "no_observations" }, { status: 404 });
    }

    await db
      .update(items)
      .set({
        valueLow: String(result.low),
        valueFair: String(result.fair),
        valueHigh: String(result.high),
        valueCurrency: "USD",
        valueConfidence: result.confidence,
        valueUpdatedAt: new Date(),
        valueBasis: { asking: result.askingCount, sold: result.soldCount },
      })
      .where(eq(items.id, item.id));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "value_failed" },
      { status: 502 },
    );
  }
}
