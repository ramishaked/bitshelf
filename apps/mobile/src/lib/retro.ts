import seedJson from "@bitshelf/db/seeds/retro_tech.json";
import type { ThemeColors } from "@bitshelf/ui";

// The retro_tech seed is the single source of truth for categories, vertical
// fields and condition labels (spec 4.0). The form and item screen are built
// from it, not hard-coded.

export interface LocalizedLabel {
  he: string;
  en: string;
}

export interface AttributeField {
  key: string;
  type: "text" | "int" | "decimal" | "enum" | "date" | "bool";
  enum_values?: string[];
  required: boolean;
  autocomplete: boolean;
  show_in_share: boolean;
  show_in_grid: boolean;
  searchable: boolean;
  applies_to?: string[];
  maps_to?: string;
  label: LocalizedLabel;
}

export interface Category {
  slug: string;
  name: LocalizedLabel;
}

interface RetroSeed {
  categories: Category[];
  attributes_schema: AttributeField[];
  condition_labels: Record<string, LocalizedLabel>;
}

const seed = seedJson as unknown as RetroSeed;

export const categories = seed.categories;
export const conditionLabels = seed.condition_labels;

export function fieldsForCategory(category: string): AttributeField[] {
  return seed.attributes_schema.filter(
    (f) => !f.applies_to || f.applies_to.includes(category),
  );
}

// Latin-only fields render LTR inside the RTL layout (spec 12)
const LATIN_FIELDS = new Set([
  "manufacturer",
  "model",
  "variant",
  "title",
  "platform",
  "publisher",
  "serial_number",
  "region",
]);

export function isLatinField(key: string): boolean {
  return LATIN_FIELDS.has(key);
}

export function buildTitle(
  category: string,
  attributes: Record<string, unknown>,
  fallback: string,
): string {
  const a = (key: string) => {
    const v = attributes[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  if (category === "software") {
    const title = a("title");
    if (!title) return fallback;
    const platform = a("platform");
    return platform ? `${title} (${platform})` : title;
  }
  const manufacturer = a("manufacturer");
  const model = a("model");
  const variant = a("variant");
  let base: string | null;
  if (model && manufacturer) {
    // avoid "Apple Apple IIc" when the model already carries the maker
    base = model.toLowerCase().startsWith(manufacturer.toLowerCase())
      ? model
      : `${manufacturer} ${model}`;
  } else {
    base = model ?? manufacturer;
  }
  if (!base) return fallback;
  return variant ? `${base} (${variant})` : base;
}

// software fields that fill core identification fields (spec 4.1.1)
export function applyMapsTo(
  category: string,
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...attributes };
  for (const field of fieldsForCategory(category)) {
    if (field.maps_to && out[field.key] != null && out[field.key] !== "") {
      out[field.maps_to] = out[field.key];
    }
  }
  return out;
}

export function statusColor(
  status: string | undefined,
  colors: ThemeColors,
): string {
  switch (status) {
    case "working":
      return colors.statusWorking;
    case "partially_working":
      return colors.statusPartiallyWorking;
    case "not_working":
    case "for_parts":
      return colors.statusNotWorking;
    default:
      return colors.statusUntested;
  }
}

// drives the "to complete" tag (spec 6.1 step 5)
export function isIncomplete(
  category: string,
  attributes: Record<string, unknown>,
  conditionGrade: number | null,
): boolean {
  if (conditionGrade == null) return true;
  return fieldsForCategory(category).some((f) => {
    if (!f.required) return false;
    const v = attributes[f.key];
    return v == null || v === "";
  });
}
