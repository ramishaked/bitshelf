// Seeds collection_types from seeds/*.json. Idempotent, upserts by slug.
// Run with: DATABASE_URL=... pnpm --filter @bitshelf/db seed
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { createDb, collectionTypes } from "./index";

const seedsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "seeds");

interface CollectionTypeSeed {
  slug: string;
  name: { he: string; en: string };
  categories: unknown[];
  attributes_schema: unknown[];
  ai_system_prompt: string;
  condition_labels: Record<string, { he: string; en: string }>;
  is_active: boolean;
}

async function main() {
  const db = createDb(process.env.DATABASE_URL ?? "");
  const seed = JSON.parse(
    readFileSync(join(seedsDir, "retro_tech.json"), "utf8"),
  ) as CollectionTypeSeed;

  await db
    .insert(collectionTypes)
    .values({
      slug: seed.slug,
      name: seed.name,
      categories: seed.categories,
      attributesSchema: seed.attributes_schema,
      aiSystemPrompt: seed.ai_system_prompt,
      conditionLabels: seed.condition_labels,
      isActive: seed.is_active,
    })
    .onConflictDoUpdate({
      target: collectionTypes.slug,
      set: {
        name: seed.name,
        categories: seed.categories,
        attributesSchema: seed.attributes_schema,
        aiSystemPrompt: seed.ai_system_prompt,
        conditionLabels: seed.condition_labels,
        isActive: seed.is_active,
        updatedAt: sql`now()`,
      },
    });

  console.log(`Seeded collection type: ${seed.slug}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
