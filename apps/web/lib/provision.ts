import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { collections, collectionTypes, users, type Db } from "@bitshelf/db";

export async function ensureUser(db: Db, clerkId: string) {
  const existing = await db.select().from(users).where(eq(users.clerkId, clerkId));
  if (existing[0]) return existing[0];
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(clerkId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;
  const inserted = await db
    .insert(users)
    .values({ clerkId, email, displayName: clerkUser.fullName })
    .onConflictDoUpdate({ target: users.clerkId, set: { email } })
    .returning();
  return inserted[0]!;
}

export async function ensureCollection(db: Db, ownerId: string) {
  const existing = await db
    .select()
    .from(collections)
    .where(eq(collections.ownerId, ownerId))
    .limit(1);
  if (existing[0]) return existing[0];
  const type = await db
    .select()
    .from(collectionTypes)
    .where(eq(collectionTypes.slug, "retro_tech"));
  if (!type[0]) {
    throw new Error("retro_tech collection type is missing, run the db seed");
  }
  const inserted = await db
    .insert(collections)
    .values({ ownerId, collectionTypeId: type[0].id, name: "האוסף שלי" })
    .returning();
  return inserted[0]!;
}

export async function getRetroTechType(db: Db) {
  const type = await db
    .select()
    .from(collectionTypes)
    .where(eq(collectionTypes.slug, "retro_tech"));
  if (!type[0]) {
    throw new Error("retro_tech collection type is missing, run the db seed");
  }
  return type[0];
}
