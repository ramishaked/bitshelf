import { eq } from "drizzle-orm";
import { createDb } from "./index";
import { users } from "./schema";

// Deletes ALL data of one user: the users row cascades to collections,
// items (and their photos, gallery memberships, favorites, repair logs),
// galleries, wishlist, insights, value snapshots and AI jobs. The next
// sign-in provisions a fresh empty account. Deliberately loud and gated.
//   pnpm --filter @bitshelf/db exec tsx src/wipe-user.ts <email> --yes

async function main() {
  const email = process.argv[2];
  const confirmed = process.argv[3] === "--yes";
  if (!email) {
    console.log("usage: tsx src/wipe-user.ts <email> --yes");
    process.exit(1);
  }
  const db = createDb(process.env.DATABASE_URL ?? "");
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    console.log(`no user with email ${email}`);
    process.exit(1);
  }
  if (!confirmed) {
    console.log(
      `this will permanently delete EVERYTHING for ${email} (${user.id}).\n` +
        "re-run with --yes to confirm",
    );
    process.exit(1);
  }
  await db.delete(users).where(eq(users.id, user.id));
  console.log(`wiped all data for ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
