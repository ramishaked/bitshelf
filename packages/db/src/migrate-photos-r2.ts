import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq, like, not, or, sql } from "drizzle-orm";
import { createDb } from "./index";
import { itemPhotos } from "./schema";

// Copies externally hosted photo files (the demo items' Wikimedia
// references) into R2 and points the rows at the bucket, so the public
// pages stop hotlinking third parties. Idempotent: rows already on the
// bucket are skipped.
//   dotenv-style env required: DATABASE_URL + the five R2_* variables
//   pnpm --filter @bitshelf/db exec tsx src/migrate-photos-r2.ts

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main() {
  const publicBase = env("R2_PUBLIC_BASE_URL").replace(/\/$/, "");
  const bucket = env("R2_BUCKET");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
  });
  const db = createDb(env("DATABASE_URL"));

  const rows = await db
    .select()
    .from(itemPhotos)
    .where(
      or(
        not(like(itemPhotos.url, `${publicBase}%`)),
        sql`${itemPhotos.thumbUrl} IS NOT NULL AND ${itemPhotos.thumbUrl} NOT LIKE ${`${publicBase}%`}`,
      ),
    );
  console.log(`${rows.length} photo rows reference external urls`);

  // one upload per distinct source URL, shared across rows
  const migrated = new Map<string, string>();
  const migrate = async (source: string): Promise<string | null> => {
    const cached = migrated.get(source);
    if (cached) return cached;
    try {
      const response = await fetch(source, {
        headers: { "User-Agent": "BitShelf/0.1 (collection app; photo migration)" },
      });
      if (!response.ok) throw new Error(String(response.status));
      const type = response.headers.get("content-type")?.split(";")[0] ?? "";
      const ext = EXT_BY_TYPE[type];
      if (!ext) throw new Error(`unsupported type ${type}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const key = `photos/${randomUUID()}.${ext}`;
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: type }),
      );
      const url = `${publicBase}/${key}`;
      migrated.set(source, url);
      console.log(`  ${source.slice(0, 80)} -> ${key} (${bytes.length} bytes)`);
      return url;
    } catch (err) {
      console.warn(`  failed ${source.slice(0, 80)}: ${String(err)}`);
      return null;
    }
  };

  let updated = 0;
  for (const row of rows) {
    const nextUrl = row.url.startsWith(publicBase) ? row.url : await migrate(row.url);
    const nextThumb =
      row.thumbUrl == null || row.thumbUrl.startsWith(publicBase)
        ? row.thumbUrl
        : ((await migrate(row.thumbUrl)) ?? nextUrl);
    if (!nextUrl) continue;
    await db
      .update(itemPhotos)
      .set({ url: nextUrl, thumbUrl: nextThumb })
      .where(eq(itemPhotos.id, row.id));
    updated += 1;
  }
  console.log(`updated ${updated} of ${rows.length} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
