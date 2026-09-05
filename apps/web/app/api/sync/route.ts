import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createDb, galleries, galleryItems, itemPhotos, items } from "@bitshelf/db";
import { ensureCollection, ensureUser } from "../../../lib/provision";

// Item shape the mobile app sends
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

interface ClientGallery {
  id: string;
  nameHe: string;
  nameEn: string | null;
  descriptionHe: string | null;
  visibility: "private" | "public_link";
  publicSlug: string | null;
  showValue: boolean;
  createdAt: string;
  updatedAt: string;
  // ordered member list, replaces gallery_items wholesale
  itemIds: string[];
}

// R2 URLs recorded after the device uploaded the files
interface ClientPhoto {
  id: string;
  itemId: string;
  url: string;
  thumbUrl: string | null;
  isPrimary: boolean;
  sortOrder: number;
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

function isValidGallery(value: unknown): value is ClientGallery {
  const v = value as ClientGallery;
  return (
    v != null &&
    typeof v.id === "string" &&
    UUID_RE.test(v.id) &&
    typeof v.nameHe === "string" &&
    (v.visibility === "private" || v.visibility === "public_link") &&
    (v.publicSlug === null || typeof v.publicSlug === "string") &&
    Array.isArray(v.itemIds) &&
    v.itemIds.every((id) => typeof id === "string" && UUID_RE.test(id))
  );
}

function isValidPhoto(value: unknown): value is ClientPhoto {
  const v = value as ClientPhoto;
  return (
    v != null &&
    typeof v.id === "string" &&
    UUID_RE.test(v.id) &&
    typeof v.itemId === "string" &&
    UUID_RE.test(v.itemId) &&
    typeof v.url === "string" &&
    v.url.startsWith("https://")
  );
}

// POST { items?, galleries?, photos? } -> { userId, collectionId, syncedIds, syncedGalleryIds, syncedPhotoIds }
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
    galleries?: unknown[];
    photos?: unknown[];
  } | null;
  const clientItems = (body?.items ?? []).filter(isValidItem).slice(0, 200);
  const clientGalleries = (body?.galleries ?? []).filter(isValidGallery).slice(0, 50);
  const clientPhotos = (body?.photos ?? []).filter(isValidPhoto).slice(0, 200);

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

  const syncedGalleryIds: string[] = [];
  for (const cg of clientGalleries) {
    const values = {
      id: cg.id,
      ownerId: user.id,
      name: { he: cg.nameHe, ...(cg.nameEn ? { en: cg.nameEn } : {}) },
      description: cg.descriptionHe ? { he: cg.descriptionHe } : null,
      visibility: cg.visibility,
      publicSlug: cg.visibility === "public_link" ? cg.publicSlug : null,
      showValue: cg.showValue ?? false,
      createdAt: new Date(cg.createdAt),
      updatedAt: new Date(cg.updatedAt),
    };
    const { id, ownerId, createdAt, ...updateSet } = values;
    try {
      await db
        .insert(galleries)
        .values(values)
        .onConflictDoUpdate({
          target: galleries.id,
          set: updateSet,
          setWhere: sql`${galleries.ownerId} = ${user.id}`,
        });
    } catch {
      // most likely a public_slug collision with another user, skip this run;
      // the app generates a fresh slug on the next share
      continue;
    }

    // membership: replace wholesale, only with items the user owns
    const owned =
      cg.itemIds.length > 0
        ? await db
            .select({ id: items.id })
            .from(items)
            .where(and(eq(items.ownerId, user.id), inArray(items.id, cg.itemIds)))
        : [];
    const ownedIds = new Set(owned.map((r) => r.id));
    await db.delete(galleryItems).where(eq(galleryItems.galleryId, cg.id));
    const rows = cg.itemIds
      .filter((itemId) => ownedIds.has(itemId))
      .map((itemId, index) => ({
        galleryId: cg.id,
        itemId,
        sortOrder: index,
      }));
    if (rows.length > 0) {
      await db.insert(galleryItems).values(rows);
    }
    syncedGalleryIds.push(cg.id);
  }

  const syncedPhotoIds: string[] = [];
  if (clientPhotos.length > 0) {
    const owned = await db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.ownerId, user.id),
          inArray(items.id, [...new Set(clientPhotos.map((p) => p.itemId))]),
        ),
      );
    const ownedIds = new Set(owned.map((r) => r.id));
    for (const cp of clientPhotos) {
      if (!ownedIds.has(cp.itemId)) continue;
      const values = {
        id: cp.id,
        itemId: cp.itemId,
        url: cp.url,
        thumbUrl: cp.thumbUrl ?? null,
        sortOrder: cp.sortOrder ?? 0,
        isPrimary: cp.isPrimary ?? false,
      };
      const { id, itemId, ...updateSet } = values;
      await db
        .insert(itemPhotos)
        .values(values)
        .onConflictDoUpdate({
          target: itemPhotos.id,
          set: updateSet,
          // an id collision may only update a photo of the same owned item
          setWhere: sql`${itemPhotos.itemId} = ${cp.itemId}`,
        });
      syncedPhotoIds.push(cp.id);
    }
  }

  return NextResponse.json({
    userId: user.id,
    collectionId: collection.id,
    syncedIds,
    syncedGalleryIds,
    syncedPhotoIds,
  });
}
