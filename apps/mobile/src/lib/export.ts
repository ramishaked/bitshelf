import { Share } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { listItems, type LocalItem } from "./store";

// CSV export (spec 7.5). The photos ZIP needs a native zip module that Expo
// Go cannot load, so it waits for the dev build; the CSV covers the data.

const COLUMNS = [
  "title",
  "category",
  "manufacturer",
  "model",
  "variant",
  "year",
  "region",
  "serial_number",
  "working_status",
  "condition_grade",
  "completeness",
  "storage_location",
  "purchase_price",
  "purchase_currency",
  "purchase_source",
  "value_low",
  "value_fair",
  "value_high",
  "is_favorite",
  "is_private",
  "tags",
  "notes",
  "created_at",
] as const;

function cell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowOf(item: LocalItem): string {
  const a = item.attributes;
  const values: Record<(typeof COLUMNS)[number], unknown> = {
    title: item.title,
    category: item.category,
    manufacturer: a.manufacturer,
    model: a.model,
    variant: a.variant,
    year: a.year,
    region: a.region,
    serial_number: a.serial_number,
    working_status: a.working_status,
    condition_grade: item.conditionGrade,
    completeness: a.completeness,
    storage_location: item.storageLocation,
    purchase_price: item.purchasePrice,
    purchase_currency: item.purchaseCurrency,
    purchase_source: item.purchaseSource,
    value_low: item.valueLow,
    value_fair: item.valueFair,
    value_high: item.valueHigh,
    is_favorite: item.isFavorite ? 1 : 0,
    is_private: item.isPrivate ? 1 : 0,
    tags: item.tags?.join(";"),
    notes: item.notes,
    created_at: item.createdAt,
  };
  return COLUMNS.map((key) => cell(values[key])).join(",");
}

export function buildItemsCsv(items: LocalItem[]): string {
  // BOM so Excel opens the Hebrew correctly
  return `﻿${COLUMNS.join(",")}\n${items.map(rowOf).join("\n")}\n`;
}

export async function exportCsv(): Promise<number> {
  const items = listItems();
  const dir = new Directory(Paths.document, "exports");
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, "bitshelf-export.csv");
  file.write(buildItemsCsv(items));
  await Share.share({ url: file.uri });
  return items.length;
}
