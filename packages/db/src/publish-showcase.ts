import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { and, asc, eq, inArray } from "drizzle-orm";
import { createDb } from "./index";
import { galleries, galleryItems, itemPhotos, items } from "./schema";

// Showcase publisher (Rami, 05.09.2026): renders one public gallery from
// Neon into a single self-contained RTL HTML file, for a permanent GitHub
// Pages link that updates on every publish. Photos stay hotlinked (R2).
// Only shareable fields are rendered, like /g/[slug].
//   DATABASE_URL=... tsx src/publish-showcase.ts <slug> <output.html> [--push]
// --push commits and pushes the file inside its own repository.

const STATUS_HE: Record<string, string> = {
  working: "עובד",
  partially_working: "עובד חלקית",
  not_working: "לא עובד",
  for_parts: "לחלקים",
  untested: "לא נבדק",
};
const STATUS_COLOR: Record<string, string> = {
  working: "#5CE65C",
  partially_working: "#F5A524",
  not_working: "#E0563F",
  for_parts: "#E0563F",
  untested: "#7A7F76",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  const slug = process.argv[2];
  const output = process.argv[3];
  const push = process.argv.includes("--push");
  if (!slug || !output) {
    console.log("usage: tsx src/publish-showcase.ts <slug> <output.html> [--push]");
    process.exit(1);
  }

  const db = createDb(process.env.DATABASE_URL ?? "");
  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.publicSlug, slug), eq(galleries.visibility, "public_link")),
  });
  if (!gallery) {
    console.log(`no public gallery with slug ${slug}`);
    process.exit(1);
  }
  const memberRows = await db
    .select({ itemId: galleryItems.itemId })
    .from(galleryItems)
    .where(eq(galleryItems.galleryId, gallery.id))
    .orderBy(asc(galleryItems.sortOrder));
  const ids = memberRows.map((r) => r.itemId);
  const itemRows =
    ids.length > 0
      ? await db.select().from(items).where(inArray(items.id, ids))
      : [];
  const photoRows =
    ids.length > 0
      ? await db
          .select()
          .from(itemPhotos)
          .where(inArray(itemPhotos.itemId, ids))
          .orderBy(asc(itemPhotos.sortOrder))
      : [];
  const photoOf = new Map<string, { url: string; thumb: string }>();
  for (const p of photoRows) {
    if (!photoOf.has(p.itemId) || p.isPrimary) {
      photoOf.set(p.itemId, { url: p.url, thumb: p.thumbUrl ?? p.url });
    }
  }
  const byId = new Map(itemRows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((r) => r != null);

  const name = gallery.name.he ?? gallery.name.en ?? "BitShelf";
  const description = gallery.description?.he ?? "";

  const tiles = ordered
    .map((row) => {
      const photo = photoOf.get(row.id);
      const status = ((row.attributes as Record<string, unknown>).working_status ??
        "untested") as string;
      const year = row.year != null ? String(row.year) : "";
      return `<figure class="tile">
  ${photo ? `<img loading="lazy" src="${esc(photo.thumb)}" alt="${esc(row.title)}">` : '<div class="noimg"></div>'}
  <span class="dot" style="background:${STATUS_COLOR[status] ?? STATUS_COLOR.untested}"></span>
  <figcaption><bdi>${esc(row.title)}</bdi>${year ? `<span class="yr">${year}</span>` : ""}</figcaption>
</figure>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}</title>
<meta property="og:title" content="${esc(name)}">
${description ? `<meta property="og:description" content="${esc(description)}">` : ""}
<style>
  :root{--bg:#0E0F0D;--surface:#1A1C18;--text:#EDEFE8;--muted:#9AA096;--accent:#5CE65C}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  .wrap{max-width:1080px;margin:0 auto;padding:24px 16px}
  .brand{font-family:ui-monospace,Menlo,monospace;color:var(--accent);font-size:13px;direction:ltr;text-align:right}
  h1{margin:8px 0 0;font-size:26px}
  .desc{margin:4px 0 0;color:var(--muted)}
  .count{margin:4px 0 16px;color:var(--muted);font-size:13px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:2px}
  .tile{position:relative;margin:0;aspect-ratio:1;background:var(--surface);overflow:hidden}
  .tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .noimg{position:absolute;inset:0}
  .dot{position:absolute;top:6px;inset-inline-end:6px;width:8px;height:8px;border-radius:4px}
  figcaption{position:absolute;inset-inline:0;bottom:0;padding:22px 6px 5px;background:linear-gradient(transparent,rgba(0,0,0,.75));color:#fff;font-family:ui-monospace,Menlo,monospace;font-size:11px;direction:ltr;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .yr{color:#bbb;margin-inline-start:6px}
  footer{margin-top:24px;padding:16px 0;color:var(--muted);font-size:12px;text-align:center}
  footer b{font-family:ui-monospace,Menlo,monospace;color:var(--accent);font-weight:600}
</style>
</head>
<body>
<main class="wrap">
  <div class="brand">BitShelf</div>
  <h1>${esc(name)}</h1>
  ${description ? `<p class="desc">${esc(description)}</p>` : ""}
  <p class="count">${ordered.length} פריטים · עודכן ${new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\./g, ".")}</p>
  <div class="grid">
${tiles}
  </div>
  <footer><b>BitShelf</b> · ניהול אוסף רטרו</footer>
</main>
</body>
</html>
`;

  const outPath = resolve(output);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  console.log(`wrote ${outPath} (${ordered.length} items)`);

  if (push) {
    const dir = dirname(outPath);
    try {
      execSync(`git -C "${dir}" add "${outPath}"`, { stdio: "inherit" });
      execSync(`git -C "${dir}" commit -m "Update showcase: ${slug}"`, {
        stdio: "inherit",
      });
      execSync(`git -C "${dir}" push`, { stdio: "inherit" });
      console.log("pushed");
    } catch {
      console.log("git push failed, the file is written locally");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
