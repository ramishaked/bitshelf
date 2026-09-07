import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  collections,
  createDb,
  galleries,
  galleryItems,
  itemPhotos,
  items,
  type LocalizedText,
} from "@bitshelf/db";
import seedJson from "@bitshelf/db/seeds/retro_tech.json";
import { darkColors } from "@bitshelf/ui/theme";

// Everything the public gallery page may show (spec 8.1). serial_number,
// purchase price, storage location and private notes never leave the server.

interface SeedField {
  key: string;
  show_in_share: boolean;
  label: { he: string; en: string };
}

const seed = seedJson as unknown as { attributes_schema: SeedField[] };
// working_status renders as its own tag, not as a detail row
const shareableFields = seed.attributes_schema.filter(
  (f) => f.show_in_share && f.key !== "working_status",
);

// Hebrew labels for enum values shown on the public page
const ENUM_VALUE_HE: Record<string, string> = {
  loose: "בודד",
  boxed: "עם קופסה",
  cib: "CIB",
  sealed: "חתום",
  floppy_525: "דיסקט 5.25",
  floppy_35: "דיסקט 3.5",
  cassette: "קלטת",
  cartridge: "קרטרידג'",
  cd: "CD",
  other: "אחר",
  universal: "אוניברסלי",
  unknown: "לא ידוע",
};

function displayValue(raw: unknown): string {
  const s = String(raw);
  return ENUM_VALUE_HE[s] ?? s;
}

export const STATUS_HE: Record<string, string> = {
  working: "עובד",
  partially_working: "עובד חלקית",
  not_working: "לא עובד",
  for_parts: "לחלקים",
  untested: "לא נבדק",
};

// same mapping as the app's status dot (UI rules: two separate dimensions)
export function statusColorFor(status: string | null): string {
  switch (status) {
    case "working":
      return darkColors.statusWorking;
    case "partially_working":
      return darkColors.statusPartiallyWorking;
    case "not_working":
    case "for_parts":
      return darkColors.statusNotWorking;
    default:
      return darkColors.statusUntested;
  }
}

export interface PublicPhoto {
  url: string;
  thumbUrl: string | null;
  isPrimary: boolean;
}

export interface PublicItem {
  id: string;
  title: string;
  category: string;
  year: number | null;
  conditionGrade: number | null;
  workingStatus: string | null;
  // key, label (he), value: only attributes flagged show_in_share in the seed
  attributes: { key: string; label: string; value: string }[];
  photos: PublicPhoto[];
}

export interface PublicGallery {
  slug: string;
  name: LocalizedText;
  description: LocalizedText | null;
  itemCount: number;
  coverUrl: string | null;
  items: PublicItem[];
}

export async function loadPublicGallery(slug: string): Promise<PublicGallery | null> {
  const db = createDb(process.env.DATABASE_URL ?? "");

  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.publicSlug, slug), eq(galleries.visibility, "public_link")),
  });
  if (!gallery) return null;

  const memberRows = await db
    .select({ itemId: galleryItems.itemId, sortOrder: galleryItems.sortOrder })
    .from(galleryItems)
    .where(eq(galleryItems.galleryId, gallery.id))
    .orderBy(asc(galleryItems.sortOrder));
  const itemIds = memberRows.map((r) => r.itemId);
  if (itemIds.length === 0) {
    return {
      slug,
      name: gallery.name,
      description: gallery.description ?? null,
      itemCount: 0,
      coverUrl: gallery.coverPhotoUrl ?? null,
      items: [],
    };
  }

  const itemRows = await db
    .select()
    .from(items)
    .where(and(inArray(items.id, itemIds), eq(items.ownerId, gallery.ownerId)));
  const photoRows = await db
    .select()
    .from(itemPhotos)
    .where(inArray(itemPhotos.itemId, itemIds))
    .orderBy(asc(itemPhotos.sortOrder));

  const photosByItem = new Map<string, PublicPhoto[]>();
  for (const p of photoRows) {
    const list = photosByItem.get(p.itemId) ?? [];
    list.push({ url: p.url, thumbUrl: p.thumbUrl, isPrimary: p.isPrimary });
    photosByItem.set(p.itemId, list);
  }

  const byId = new Map(itemRows.map((r) => [r.id, r]));
  const publicItems: PublicItem[] = [];
  for (const { itemId } of memberRows) {
    const row = byId.get(itemId);
    if (!row) continue;
    const attributes = shareableFields
      .map((f) => {
        const v = (row.attributes as Record<string, unknown>)[f.key];
        return v == null || v === ""
          ? null
          : { key: f.key, label: f.label.he, value: displayValue(v) };
      })
      .filter((v): v is PublicItem["attributes"][number] => v != null);
    publicItems.push({
      id: row.id,
      title: row.title,
      category: row.category,
      year: row.year,
      conditionGrade: row.conditionGrade,
      workingStatus:
        ((row.attributes as Record<string, unknown>).working_status as string) ?? null,
      attributes,
      photos: photosByItem.get(itemId) ?? [],
    });
  }

  const coverUrl =
    gallery.coverPhotoUrl ??
    publicItems
      .flatMap((i) => i.photos)
      .find((p) => p.isPrimary)?.url ??
    publicItems[0]?.photos[0]?.url ??
    null;

  return {
    slug,
    name: gallery.name,
    description: gallery.description ?? null,
    itemCount: publicItems.length,
    coverUrl,
    items: publicItems,
  };
}

export interface CollectorGalleryCard {
  slug: string;
  name: LocalizedText;
  itemCount: number;
  coverUrl: string | null;
}

export interface CollectorShowcase {
  handle: string;
  title: string;
  bio: string | null;
  galleries: CollectorGalleryCard[];
}

// Collector showcase page (spec 8.1.2): one public page per collector at
// /u/<handle>, a bio header plus a card for every published gallery. Only
// reachable when the collector turned showcase_published on.
export async function loadCollectorShowcase(
  handle: string,
): Promise<CollectorShowcase | null> {
  const db = createDb(process.env.DATABASE_URL ?? "");

  const collection = await db.query.collections.findFirst({
    where: and(eq(collections.handle, handle), eq(collections.showcasePublished, true)),
  });
  if (!collection) return null;

  const galleryRows = await db
    .select()
    .from(galleries)
    .where(and(eq(galleries.ownerId, collection.ownerId), eq(galleries.visibility, "public_link")))
    .orderBy(desc(galleries.updatedAt));

  const cards: CollectorGalleryCard[] = [];
  for (const g of galleryRows) {
    if (!g.publicSlug) continue;
    const members = await db
      .select({ itemId: galleryItems.itemId, sortOrder: galleryItems.sortOrder })
      .from(galleryItems)
      .where(eq(galleryItems.galleryId, g.id))
      .orderBy(asc(galleryItems.sortOrder));
    let coverUrl = g.coverPhotoUrl ?? null;
    if (!coverUrl && members.length > 0) {
      const firstPhotos = await db
        .select()
        .from(itemPhotos)
        .where(inArray(itemPhotos.itemId, members.map((m) => m.itemId)))
        .orderBy(asc(itemPhotos.sortOrder));
      coverUrl =
        firstPhotos.find((p) => p.isPrimary)?.url ?? firstPhotos[0]?.url ?? null;
    }
    cards.push({
      slug: g.publicSlug,
      name: g.name,
      itemCount: members.length,
      coverUrl,
    });
  }

  return {
    handle,
    title: collection.showcaseTitle || collection.name,
    bio: collection.bio ?? null,
    galleries: cards,
  };
}

export interface CollectorCard {
  handle: string;
  title: string;
  bio: string | null;
  galleryCount: number;
  // up to three covers for a small mosaic
  covers: string[];
}

// Community home: every collector who published a showcase, newest first.
// Opt-in only (showcase_published), so nobody is listed without choosing to.
export async function listPublishedCollectors(): Promise<CollectorCard[]> {
  const db = createDb(process.env.DATABASE_URL ?? "");
  const rows = await db
    .select()
    .from(collections)
    .where(eq(collections.showcasePublished, true))
    .orderBy(desc(collections.updatedAt))
    .limit(100);

  const cards: CollectorCard[] = [];
  for (const c of rows) {
    if (!c.handle) continue;
    const publicGalleries = await db
      .select({ id: galleries.id, coverPhotoUrl: galleries.coverPhotoUrl })
      .from(galleries)
      .where(and(eq(galleries.ownerId, c.ownerId), eq(galleries.visibility, "public_link")));
    const covers: string[] = [];
    for (const g of publicGalleries) {
      if (covers.length >= 3) break;
      if (g.coverPhotoUrl) {
        covers.push(g.coverPhotoUrl);
        continue;
      }
      const member = await db
        .select({ itemId: galleryItems.itemId })
        .from(galleryItems)
        .where(eq(galleryItems.galleryId, g.id))
        .orderBy(asc(galleryItems.sortOrder))
        .limit(1);
      if (member[0]) {
        const photo = await db
          .select({ url: itemPhotos.url })
          .from(itemPhotos)
          .where(eq(itemPhotos.itemId, member[0].itemId))
          .orderBy(asc(itemPhotos.sortOrder))
          .limit(1);
        if (photo[0]) covers.push(photo[0].url);
      }
    }
    cards.push({
      handle: c.handle,
      title: c.showcaseTitle || c.name,
      bio: c.bio ?? null,
      galleryCount: publicGalleries.length,
      covers,
    });
  }
  return cards;
}
