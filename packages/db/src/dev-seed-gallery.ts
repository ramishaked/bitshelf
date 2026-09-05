import { and, eq, isNull } from "drizzle-orm";
import { createDb } from "./index";
import { galleries, galleryItems, items } from "./schema";

// Dev-only helper: creates (or removes) a public test gallery from the first
// synced items, so /g/[slug] can be verified end to end before the app flow
// is exercised on a device. Not part of the seed.
//   pnpm --filter @bitshelf/db exec tsx src/dev-seed-gallery.ts create
//   pnpm --filter @bitshelf/db exec tsx src/dev-seed-gallery.ts remove
const SLUG = "dev-check-gallery";

async function main() {
  const action = process.argv[2] ?? "create";
  const db = createDb(process.env.DATABASE_URL ?? "");

  if (action === "remove") {
    const existing = await db.query.galleries.findFirst({
      where: eq(galleries.publicSlug, SLUG),
    });
    if (existing) {
      await db.delete(galleries).where(eq(galleries.id, existing.id));
      console.log("removed", existing.id);
    } else {
      console.log("nothing to remove");
    }
    return;
  }

  const rows = await db
    .select({ id: items.id, ownerId: items.ownerId, title: items.title })
    .from(items)
    .where(and(isNull(items.parentItemId)))
    .limit(4);
  const first = rows[0];
  if (!first) {
    console.log("no items in the database, sync some first");
    return;
  }
  const ownerId = first.ownerId;
  const owned = rows.filter((r) => r.ownerId === ownerId);

  const [gallery] = await db
    .insert(galleries)
    .values({
      ownerId,
      name: { he: "גלריית בדיקה", en: "Dev check gallery" },
      description: { he: "נוצרה אוטומטית לבדיקת הדף הציבורי" },
      visibility: "public_link",
      publicSlug: SLUG,
    })
    .onConflictDoNothing({ target: galleries.publicSlug })
    .returning();
  if (!gallery) {
    console.log("gallery already exists");
    return;
  }
  await db.insert(galleryItems).values(
    owned.map((r, index) => ({
      galleryId: gallery.id,
      itemId: r.id,
      sortOrder: index,
    })),
  );
  console.log("created", gallery.id, "with", owned.map((r) => r.title).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
