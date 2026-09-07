import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { createDb, itemPhotos, items, users } from "@bitshelf/db";
import { deletePhotoObjects, photoKeyOf, r2Configured } from "@bitshelf/api";

// DELETE -> removes the caller's account entirely (spec 12, App Store
// requirement): photo objects leave R2 first, the users row cascades to
// collections, items, photo rows, galleries, wishlist, snapshots and AI
// jobs, then the Clerk user is deleted so the sign-in itself is gone.
export async function DELETE() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createDb(process.env.DATABASE_URL ?? "");
  const row = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
  if (row) {
    // best effort: a failed object delete must not block the account wipe
    if (r2Configured()) {
      try {
        const photoRows = await db
          .select({ url: itemPhotos.url, thumbUrl: itemPhotos.thumbUrl })
          .from(itemPhotos)
          .innerJoin(items, eq(itemPhotos.itemId, items.id))
          .where(eq(items.ownerId, row.id));
        const keys = photoRows
          .flatMap((p) => [p.url, p.thumbUrl])
          .map((url) => (url ? photoKeyOf(url) : null))
          .filter((k): k is string => k != null);
        await deletePhotoObjects([...new Set(keys)]);
      } catch {
        // orphaned objects age out with lifecycle rules later
      }
    }
    await db.delete(users).where(eq(users.id, row.id));
  }
  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(clerkId);
  } catch {
    // data is gone; the orphaned sign-in provisions an empty account if
    // it is ever used again
    return NextResponse.json({ ok: true, authDeleted: false });
  }
  return NextResponse.json({ ok: true, authDeleted: true });
}
