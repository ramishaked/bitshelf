import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sql } from "drizzle-orm";
import { createDb, items } from "@bitshelf/db";
import { ensureCollection, ensureUser } from "../../../lib/provision";

// Item shape the mobile app sends. Photos are not synced yet, they wait for R2.
interface ClientItem {
  id: string;
  category: string;
  title: string;
  attributes: Record<string, unknown>;
  conditionGrade: number | null;
  conditionNotes: string | null;
  storageLocation: string | null;
  notes: string | null;
  purchasePrice: string | null;
  purchaseCurrency: "ILS" | "USD" | null;
  purchaseSource: string | null;
  isPrivate: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidItem(value: unknown): value is ClientItem {
  const v = value as ClientItem;
  return (
    v != null &&
    typeof v.id === "string" &&
    UUID_RE.test(v.id) &&
    typeof v.category === "string" &&
    typeof v.title === "string" &&
    v.attributes != null &&
    typeof v.attributes === "object"
  );
}

// POST { items: ClientItem[] } -> { userId, collectionId, syncedIds }
// First call provisions the Neon user row and a default collection.
export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createDb(process.env.DATABASE_URL ?? "");
  const user = await ensureUser(db, clerkId);
  const collection = await ensureCollection(db, user.id);

  const body = (await request.json().catch(() => null)) as {
    items?: unknown[];
  } | null;
  const clientItems = (body?.items ?? []).filter(isValidItem).slice(0, 200);

  const syncedIds: string[] = [];
  for (const ci of clientItems) {
    const values = {
      id: ci.id,
      ownerId: user.id,
      collectionId: collection.id,
      category: ci.category,
      title: ci.title,
      attributes: ci.attributes,
      conditionGrade: ci.conditionGrade ?? null,
      conditionNotes: ci.conditionNotes ?? null,
      storageLocation: ci.storageLocation ?? null,
      notes: ci.notes ?? null,
      purchasePrice: ci.purchasePrice ?? null,
      purchaseCurrency: ci.purchaseCurrency ?? null,
      purchaseSource: ci.purchaseSource ?? null,
      isPrivate: ci.isPrivate ?? true,
      isFavorite: ci.isFavorite ?? false,
      createdAt: new Date(ci.createdAt),
      updatedAt: new Date(ci.updatedAt),
    };
    const { id, ownerId, collectionId, createdAt, ...updateSet } = values;
    await db
      .insert(items)
      .values(values)
      .onConflictDoUpdate({
        target: items.id,
        set: updateSet,
        // never let one user overwrite another user's item
        setWhere: sql`${items.ownerId} = ${user.id}`,
      });
    syncedIds.push(ci.id);
  }

  return NextResponse.json({
    userId: user.id,
    collectionId: collection.id,
    syncedIds,
  });
}
