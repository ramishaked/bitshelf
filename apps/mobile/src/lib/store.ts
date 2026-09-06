import { openDatabaseSync } from "expo-sqlite";
import { randomUUID } from "expo-crypto";

// Local-first cache (spec 10): the grid opens from SQLite with no network.
// Server sync attaches later, `synced` marks rows waiting for upload.

export interface LocalPhoto {
  id: string;
  uri: string;
  thumbUri: string;
  isPrimary: boolean;
  // filled after the file is uploaded to R2, absent until then
  remoteUrl?: string;
  remoteThumbUrl?: string;
}

export interface LocalRepair {
  id: string;
  date: string;
  description: string;
  cost: string | null;
}

export interface LocalItem {
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
  // "from_scan" marks shelf scan items until they get a close-up (spec 6.3)
  tags?: string[];
  // sets (spec 4.3): depth 1 only, a child cannot have children
  parentItemId?: string | null;
  // filled by the value engine on the server (week 6), read-only on device
  valueLow?: string | null;
  valueFair?: string | null;
  valueHigh?: string | null;
  valueCurrency?: "ILS" | "USD" | null;
  valueConfidence?: string | null;
  valueUpdatedAt?: string | null;
  // repair log (spec 7.2), local only for now
  repairs?: LocalRepair[];
  photos: LocalPhoto[];
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

const db = openDatabaseSync("bitshelf.db");

db.execSync(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    manufacturer TEXT,
    model TEXT,
    year INTEGER,
    working_status TEXT,
    condition_grade INTEGER,
    is_private INTEGER NOT NULL DEFAULT 1,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS galleries (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS gallery_items (
    gallery_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (gallery_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS deleted_items (
    id TEXT PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS deleted_galleries (
    id TEXT PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS wishlist (
    id TEXT PRIMARY KEY,
    priority INTEGER NOT NULL DEFAULT 2,
    created_at TEXT NOT NULL,
    json TEXT NOT NULL
  );
`);

// Account deletion (spec 12): clear every data table on this device.
// Settings (language, appearance) survive, they are not account data.
export function wipeLocalData(): void {
  for (const table of [
    "items",
    "galleries",
    "gallery_items",
    "deleted_items",
    "deleted_galleries",
    "wishlist",
  ]) {
    db.runSync(`DELETE FROM ${table}`);
  }
}

export function getSetting(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key],
  );
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.runSync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [
    key,
    value,
  ]);
}

// lightweight migration: older installs lack the parent column
try {
  db.execSync("ALTER TABLE items ADD COLUMN parent_item_id TEXT");
} catch {
  // column already exists
}

export function newItemId(): string {
  return randomUUID();
}

function asInt(value: unknown): number | null {
  const n = typeof value === "string" ? parseInt(value, 10) : (value as number);
  return Number.isFinite(n) ? n : null;
}

export function saveItem(item: LocalItem): void {
  db.runSync(
    `INSERT OR REPLACE INTO items
      (id, title, category, manufacturer, model, year, working_status,
       condition_grade, is_private, is_favorite, parent_item_id,
       created_at, updated_at, synced, json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.title,
      item.category,
      (item.attributes.manufacturer as string) ?? null,
      (item.attributes.model as string) ?? null,
      asInt(item.attributes.year),
      (item.attributes.working_status as string) ?? null,
      item.conditionGrade,
      item.isPrivate ? 1 : 0,
      item.isFavorite ? 1 : 0,
      item.parentItemId ?? null,
      item.createdAt,
      item.updatedAt,
      item.synced ? 1 : 0,
      JSON.stringify(item),
    ],
  );
}

// --- sets (spec 4.3): depth 1, parent shows children as a row ---

export function listChildren(parentId: string): LocalItem[] {
  const rows = db.getAllSync<{ json: string }>(
    "SELECT json FROM items WHERE parent_item_id = ? ORDER BY created_at",
    [parentId],
  );
  return rows.map(parseRow);
}

export function setItemParent(childId: string, parentId: string | null): void {
  const child = getItem(childId);
  if (!child) return;
  saveItem({
    ...child,
    parentItemId: parentId,
    updatedAt: new Date().toISOString(),
    synced: false,
  });
}

// candidates for "add to set": parentless, childless, not the parent itself
export function listSetCandidates(parentId: string): LocalItem[] {
  const rows = db.getAllSync<{ json: string }>(
    `SELECT json FROM items
     WHERE id != ? AND parent_item_id IS NULL
       AND id NOT IN (SELECT DISTINCT parent_item_id FROM items WHERE parent_item_id IS NOT NULL)
     ORDER BY created_at DESC`,
    [parentId],
  );
  return rows.map(parseRow);
}

export function addRepair(itemId: string, repair: LocalRepair): void {
  const item = getItem(itemId);
  if (!item) return;
  saveItem({
    ...item,
    repairs: [...(item.repairs ?? []), repair],
    updatedAt: new Date().toISOString(),
    // repairs are local only for now, the row itself still resyncs harmlessly
    synced: false,
  });
}

function parseRow(row: { json: string }): LocalItem {
  return JSON.parse(row.json) as LocalItem;
}

export function listItems(): LocalItem[] {
  const rows = db.getAllSync<{ json: string }>(
    "SELECT json FROM items ORDER BY created_at DESC",
  );
  return rows.map(parseRow);
}

export function getItem(id: string): LocalItem | null {
  const row = db.getFirstSync<{ json: string }>(
    "SELECT json FROM items WHERE id = ?",
    [id],
  );
  return row ? parseRow(row) : null;
}

// a tombstone rides on the next sync so the server row is deleted too and
// the pull merge does not resurrect the item
export function deleteItem(id: string): void {
  db.runSync("DELETE FROM items WHERE id = ?", [id]);
  db.runSync("INSERT OR IGNORE INTO deleted_items (id) VALUES (?)", [id]);
}

export function listDeletedIds(): string[] {
  const rows = db.getAllSync<{ id: string }>("SELECT id FROM deleted_items");
  return rows.map((r) => r.id);
}

export function clearDeletedIds(ids: string[]): void {
  for (const id of ids) {
    db.runSync("DELETE FROM deleted_items WHERE id = ?", [id]);
  }
}

// pull merge (spec 10: the server is the backup): inserts server items this
// device has never seen. Local rows always win for user-edited fields,
// tombstoned ids stay dead. Synced local rows still adopt server-owned
// data: photos when the device has none, value fields, and set links.
export function mergeServerItems(serverItems: LocalItem[]): number {
  const tombstones = new Set(listDeletedIds());
  let added = 0;
  for (const item of serverItems) {
    if (tombstones.has(item.id)) continue;
    const existing = getItem(item.id);
    if (existing) {
      if (!existing.synced) continue;
      const updated: LocalItem = {
        ...existing,
        photos:
          existing.photos.length === 0 && item.photos.length > 0
            ? item.photos
            : existing.photos,
        parentItemId: item.parentItemId ?? null,
        valueLow: item.valueLow ?? null,
        valueFair: item.valueFair ?? null,
        valueHigh: item.valueHigh ?? null,
        valueCurrency: item.valueCurrency ?? null,
        valueConfidence: item.valueConfidence ?? null,
        valueUpdatedAt: item.valueUpdatedAt ?? null,
      };
      if (JSON.stringify(updated) !== JSON.stringify(existing)) {
        saveItem(updated);
      }
      continue;
    }
    saveItem({ ...item, synced: true });
    added += 1;
  }
  return added;
}

// duplicate check before save (spec 6.4): same manufacturer, model and variant
export function findDuplicate(
  manufacturer: unknown,
  model: unknown,
  variant: unknown,
  excludeId?: string,
): LocalItem | null {
  if (typeof manufacturer !== "string" || typeof model !== "string") return null;
  const rows = db.getAllSync<{ json: string }>(
    "SELECT json FROM items WHERE manufacturer = ? AND model = ? AND id != ?",
    [manufacturer, model, excludeId ?? ""],
  );
  const wanted = typeof variant === "string" ? variant.trim().toLowerCase() : "";
  for (const row of rows) {
    const item = parseRow(row);
    const existing =
      typeof item.attributes.variant === "string"
        ? item.attributes.variant.trim().toLowerCase()
        : "";
    if (existing === wanted) return item;
  }
  return null;
}

export function listUnsynced(): LocalItem[] {
  const rows = db.getAllSync<{ json: string }>(
    "SELECT json FROM items WHERE synced = 0 ORDER BY created_at",
  );
  return rows.map(parseRow);
}

// only marks rows that were not edited again while the upload was in flight
export function markSynced(sent: { id: string; updatedAt: string }[]): void {
  for (const { id, updatedAt } of sent) {
    db.runSync(
      "UPDATE items SET synced = 1, json = json_set(json, '$.synced', json('true')) WHERE id = ? AND updated_at = ?",
      [id, updatedAt],
    );
  }
}

// long-press actions (spec 7.1): both mark the row for the next sync push
export function toggleFavorite(id: string): void {
  const item = getItem(id);
  if (!item) return;
  saveItem({
    ...item,
    isFavorite: !item.isFavorite,
    updatedAt: new Date().toISOString(),
    synced: false,
  });
}

export function setItemPrivate(id: string, isPrivate: boolean): void {
  const item = getItem(id);
  if (!item) return;
  saveItem({
    ...item,
    isPrivate,
    updatedAt: new Date().toISOString(),
    synced: false,
  });
}

export function listFavorites(): LocalItem[] {
  const rows = db.getAllSync<{ json: string }>(
    "SELECT json FROM items WHERE is_favorite = 1 ORDER BY created_at DESC",
  );
  return rows.map(parseRow);
}

// records remote URLs after an R2 upload without touching the synced flag,
// the photo rows themselves ride on the next sync call
export function updateItemPhotos(id: string, photos: LocalPhoto[]): void {
  const item = getItem(id);
  if (!item) return;
  db.runSync("UPDATE items SET json = ? WHERE id = ?", [
    JSON.stringify({ ...item, photos }),
    id,
  ]);
}

// --- galleries (spec 7.3), local-first like items ---

export interface LocalGallery {
  id: string;
  nameHe: string;
  nameEn: string | null;
  descriptionHe: string | null;
  visibility: "private" | "public_link";
  publicSlug: string | null;
  showValue: boolean;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export function saveGallery(gallery: LocalGallery): void {
  db.runSync(
    `INSERT OR REPLACE INTO galleries (id, created_at, updated_at, synced, json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      gallery.id,
      gallery.createdAt,
      gallery.updatedAt,
      gallery.synced ? 1 : 0,
      JSON.stringify(gallery),
    ],
  );
}

function parseGalleryRow(row: { json: string }): LocalGallery {
  return JSON.parse(row.json) as LocalGallery;
}

export function listGalleries(): LocalGallery[] {
  const rows = db.getAllSync<{ json: string }>(
    "SELECT json FROM galleries ORDER BY created_at DESC",
  );
  return rows.map(parseGalleryRow);
}

export function getGallery(id: string): LocalGallery | null {
  const row = db.getFirstSync<{ json: string }>(
    "SELECT json FROM galleries WHERE id = ?",
    [id],
  );
  return row ? parseGalleryRow(row) : null;
}

// tombstoned like items, so the server row dies and pulls do not revive it
export function deleteGallery(id: string): void {
  db.runSync("DELETE FROM gallery_items WHERE gallery_id = ?", [id]);
  db.runSync("DELETE FROM galleries WHERE id = ?", [id]);
  db.runSync("INSERT OR IGNORE INTO deleted_galleries (id) VALUES (?)", [id]);
}

export function listDeletedGalleryIds(): string[] {
  const rows = db.getAllSync<{ id: string }>("SELECT id FROM deleted_galleries");
  return rows.map((r) => r.id);
}

export function clearDeletedGalleryIds(ids: string[]): void {
  for (const id of ids) {
    db.runSync("DELETE FROM deleted_galleries WHERE id = ?", [id]);
  }
}

// pull merge for galleries: only rows this device has never seen
export function mergeServerGalleries(
  serverGalleries: (LocalGallery & { itemIds: string[] })[],
): number {
  const tombstones = new Set(listDeletedGalleryIds());
  let added = 0;
  for (const gallery of serverGalleries) {
    if (tombstones.has(gallery.id)) continue;
    if (getGallery(gallery.id)) continue;
    const { itemIds, ...row } = gallery;
    saveGallery({ ...row, synced: true });
    setGalleryItems(gallery.id, itemIds);
    added += 1;
  }
  return added;
}

// replaces the member list, keeping the given order (spec 7.3: manual sort)
export function setGalleryItems(galleryId: string, itemIds: string[]): void {
  db.runSync("DELETE FROM gallery_items WHERE gallery_id = ?", [galleryId]);
  itemIds.forEach((itemId, index) => {
    db.runSync(
      "INSERT INTO gallery_items (gallery_id, item_id, sort_order) VALUES (?, ?, ?)",
      [galleryId, itemId, index],
    );
  });
}

export function listGalleryItemIds(galleryId: string): string[] {
  const rows = db.getAllSync<{ item_id: string }>(
    "SELECT item_id FROM gallery_items WHERE gallery_id = ? ORDER BY sort_order",
    [galleryId],
  );
  return rows.map((r) => r.item_id);
}

export function listGalleryItems(galleryId: string): LocalItem[] {
  const rows = db.getAllSync<{ json: string }>(
    `SELECT i.json FROM gallery_items gi
     JOIN items i ON i.id = gi.item_id
     WHERE gi.gallery_id = ? ORDER BY gi.sort_order`,
    [galleryId],
  );
  return rows.map(parseRow);
}

export function galleryItemCount(galleryId: string): number {
  const row = db.getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM gallery_items WHERE gallery_id = ?",
    [galleryId],
  );
  return row?.n ?? 0;
}

export function addItemToGallery(galleryId: string, itemId: string): void {
  const row = db.getFirstSync<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM gallery_items WHERE gallery_id = ?",
    [galleryId],
  );
  db.runSync(
    "INSERT OR IGNORE INTO gallery_items (gallery_id, item_id, sort_order) VALUES (?, ?, ?)",
    [galleryId, itemId, (row?.m ?? -1) + 1],
  );
}

export function removeItemFromGallery(galleryId: string, itemId: string): void {
  db.runSync("DELETE FROM gallery_items WHERE gallery_id = ? AND item_id = ?", [
    galleryId,
    itemId,
  ]);
}

export function listUnsyncedGalleries(): LocalGallery[] {
  const rows = db.getAllSync<{ json: string }>(
    "SELECT json FROM galleries WHERE synced = 0 ORDER BY created_at",
  );
  return rows.map(parseGalleryRow);
}

export function markGalleriesSynced(
  sent: { id: string; updatedAt: string }[],
): void {
  for (const { id, updatedAt } of sent) {
    db.runSync(
      "UPDATE galleries SET synced = 1, json = json_set(json, '$.synced', json('true')) WHERE id = ? AND updated_at = ?",
      [id, updatedAt],
    );
  }
}

// mirrors values the server just computed, without touching the synced flag
export function updateItemValues(
  id: string,
  values: Pick<
    LocalItem,
    "valueLow" | "valueFair" | "valueHigh" | "valueCurrency" | "valueConfidence" | "valueUpdatedAt"
  >,
): void {
  const item = getItem(id);
  if (!item) return;
  db.runSync("UPDATE items SET json = ? WHERE id = ?", [
    JSON.stringify({ ...item, ...values }),
    id,
  ]);
}

// --- wishlist (spec 7.9), local only for now ---

export interface LocalWish {
  id: string;
  manufacturer: string;
  model: string;
  variant: string | null;
  targetPrice: string | null;
  priority: 1 | 2 | 3;
  status: "searching" | "found" | "purchased";
  createdAt: string;
  updatedAt: string;
}

export function saveWish(wish: LocalWish): void {
  db.runSync(
    "INSERT OR REPLACE INTO wishlist (id, priority, created_at, json) VALUES (?, ?, ?, ?)",
    [wish.id, wish.priority, wish.createdAt, JSON.stringify(wish)],
  );
}

export function listWishes(): LocalWish[] {
  const rows = db.getAllSync<{ json: string }>(
    "SELECT json FROM wishlist ORDER BY priority, created_at DESC",
  );
  return rows.map((r) => JSON.parse(r.json) as LocalWish);
}

export function deleteWish(id: string): void {
  db.runSync("DELETE FROM wishlist WHERE id = ?", [id]);
}

// membership edits must reach the server even when the gallery row itself is
// already synced, so any member change flips the gallery back to unsynced
export function touchGallery(id: string): void {
  const gallery = getGallery(id);
  if (!gallery) return;
  saveGallery({
    ...gallery,
    updatedAt: new Date().toISOString(),
    synced: false,
  });
}
