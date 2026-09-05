import type { LocalItem } from "./store";
import { isIncomplete } from "./retro";

// In-memory filtering over the loaded list (spec 10: local search, the whole
// collection is already in memory for the grid). One value per dimension,
// dimensions combine with AND.

export interface ItemFilters {
  query: string;
  category: string | null;
  manufacturer: string | null;
  decade: number | null;
  workingStatus: string | null;
  favoritesOnly: boolean;
  toCompleteOnly: boolean;
  privateOnly: boolean;
}

export const emptyFilters: ItemFilters = {
  query: "",
  category: null,
  manufacturer: null,
  decade: null,
  workingStatus: null,
  favoritesOnly: false,
  toCompleteOnly: false,
  privateOnly: false,
};

export function hasActiveFilters(f: ItemFilters): boolean {
  return (
    f.query.trim() !== "" ||
    f.category != null ||
    f.manufacturer != null ||
    f.decade != null ||
    f.workingStatus != null ||
    f.favoritesOnly ||
    f.toCompleteOnly ||
    f.privateOnly
  );
}

// free text search fields per spec 7.1: manufacturer, model, tags, notes,
// storage location, plus title and the searchable software fields
function searchBlob(item: LocalItem): string {
  const a = item.attributes;
  return [
    item.title,
    a.manufacturer,
    a.model,
    a.variant,
    a.platform,
    a.publisher,
    item.notes,
    item.storageLocation,
    Array.isArray(a.tags) ? a.tags.join(" ") : null,
  ]
    .filter((v): v is string => typeof v === "string" && v !== "")
    .join(" ")
    .toLowerCase();
}

function decadeOf(item: LocalItem): number | null {
  const year = item.attributes.year;
  const n = typeof year === "string" ? parseInt(year, 10) : (year as number);
  return Number.isFinite(n) && n > 1900 ? Math.floor(n / 10) * 10 : null;
}

export function applyFilters(items: LocalItem[], f: ItemFilters): LocalItem[] {
  const query = f.query.trim().toLowerCase();
  return items.filter((item) => {
    if (query && !searchBlob(item).includes(query)) return false;
    if (f.category && item.category !== f.category) return false;
    if (f.manufacturer && item.attributes.manufacturer !== f.manufacturer) {
      return false;
    }
    if (f.decade != null && decadeOf(item) !== f.decade) return false;
    if (f.workingStatus) {
      const status = (item.attributes.working_status as string) ?? "untested";
      if (status !== f.workingStatus) return false;
    }
    if (f.favoritesOnly && !item.isFavorite) return false;
    if (f.privateOnly && !item.isPrivate) return false;
    if (
      f.toCompleteOnly &&
      !isIncomplete(item.category, item.attributes, item.conditionGrade)
    ) {
      return false;
    }
    return true;
  });
}

// chip values are drawn from the collection itself, most frequent first
function countBy(values: (string | number)[]): (string | number)[] {
  const counts = new Map<string | number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

export function manufacturersOf(items: LocalItem[]): string[] {
  return countBy(
    items
      .map((i) => i.attributes.manufacturer)
      .filter((v): v is string => typeof v === "string" && v !== ""),
  ) as string[];
}

export function categoriesOf(items: LocalItem[]): string[] {
  return countBy(items.map((i) => i.category)) as string[];
}

export function decadesOf(items: LocalItem[]): number[] {
  return (
    countBy(
      items
        .map(decadeOf)
        .filter((v): v is number => v != null),
    ) as number[]
  ).sort((a, b) => a - b);
}
