import { openDatabaseSync } from "expo-sqlite";
import { randomUUID } from "expo-crypto";

// Local-first cache (spec 10): the grid opens from SQLite with no network.
// Server sync attaches later, `synced` marks rows waiting for upload.

export interface LocalPhoto {
  id: string;
  uri: string;
  thumbUri: string;
  isPrimary: boolean;
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
`);

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
       condition_grade, is_private, is_favorite, created_at, updated_at, synced, json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      item.createdAt,
      item.updatedAt,
      item.synced ? 1 : 0,
      JSON.stringify(item),
    ],
  );
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

export function deleteItem(id: string): void {
  db.runSync("DELETE FROM items WHERE id = ?", [id]);
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
