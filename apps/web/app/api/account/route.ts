import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { createDb, users } from "@bitshelf/db";

// DELETE -> removes the caller's account entirely (spec 12, App Store
// requirement): the users row cascades to collections, items, photos rows,
// galleries, wishlist, snapshots and AI jobs, then the Clerk user is
// deleted so the sign-in itself is gone. Photo objects in R2 are not
// enumerated here yet (R2 is not configured); revisit when keys land.
export async function DELETE() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createDb(process.env.DATABASE_URL ?? "");
  const row = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
  if (row) {
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
