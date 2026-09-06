import { eq, sql } from "drizzle-orm";
import { items, valueSnapshots, type Db } from "@bitshelf/db";

// Daily collection totals (spec 9): one row per collection per day, upserted
// whenever a value changes, so the dashboard can grow a history graph later.
export async function upsertValueSnapshot(db: Db, collectionId: string): Promise<void> {
  const [totals] = await db
    .select({
      low: sql<string | null>`sum(${items.valueLow})`,
      fair: sql<string | null>`sum(${items.valueFair})`,
      high: sql<string | null>`sum(${items.valueHigh})`,
      count: sql<number>`count(*)`,
    })
    .from(items)
    .where(eq(items.collectionId, collectionId));
  if (!totals) return;

  const today = new Date().toISOString().slice(0, 10);
  const values = {
    totalLow: totals.low,
    totalFair: totals.fair,
    totalHigh: totals.high,
    itemCount: Number(totals.count),
  };
  await db
    .insert(valueSnapshots)
    .values({ collectionId, date: today, ...values })
    .onConflictDoUpdate({
      target: [valueSnapshots.collectionId, valueSnapshots.date],
      set: values,
    });
}
