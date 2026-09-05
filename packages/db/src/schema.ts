import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// tsvector is not built into drizzle, minimal custom type for generated search columns
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// Bilingual value stored as jsonb, both fields optional (spec section 12)
export type LocalizedText = { he?: string; en?: string };

export const currencyEnum = pgEnum("currency", ["ILS", "USD"]);
export const valueConfidenceEnum = pgEnum("value_confidence", [
  "none",
  "low",
  "medium",
  "high",
]);
export const photoAngleEnum = pgEnum("photo_angle", [
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom",
  "inside",
  "label",
  "box",
  "media",
  "detail",
]);
export const repairPerformedByEnum = pgEnum("repair_performed_by", [
  "self",
  "external",
]);
export const galleryVisibilityEnum = pgEnum("gallery_visibility", [
  "private",
  "group",
  "public_link",
]);
export const gallerySortModeEnum = pgEnum("gallery_sort_mode", [
  "manual",
  "year",
  "manufacturer",
  "added",
]);
export const priceObservationSourceEnum = pgEnum("price_observation_source", [
  "ebay_sold",
  "ebay_active",
  "facebook_group",
  "manual",
  "ai_estimate",
]);
export const priceSourceTypeEnum = pgEnum("price_source_type", [
  "facebook_group",
  "ebay",
  "other",
]);
export const wishlistStatusEnum = pgEnum("wishlist_status", [
  "searching",
  "found",
  "purchased",
  "cancelled",
]);
export const aiJobKindEnum = pgEnum("ai_job_kind", [
  "identify_item",
  "shelf_scan",
  "generate_post",
]);
export const aiJobStatusEnum = pgEnum("ai_job_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);
export const insightSeverityEnum = pgEnum("insight_severity", ["info", "warn"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email"),
  displayName: text("display_name"),
  locale: text("locale").notNull().default("he"),
  defaultCurrency: currencyEnum("default_currency").notNull().default("ILS"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collectionTypes = pgTable("collection_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: jsonb("name").$type<LocalizedText>().notNull(),
  // [{ slug, name: { he, en } }]
  categories: jsonb("categories").notNull(),
  // [{ key, type, enum_values?, required, autocomplete, show_in_share, show_in_grid, searchable, applies_to?, maps_to? }]
  attributesSchema: jsonb("attributes_schema").notNull(),
  aiSystemPrompt: text("ai_system_prompt").notNull(),
  // { "1": { he, en }, ... "5": { he, en } }
  conditionLabels: jsonb("condition_labels").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectionTypeId: uuid("collection_type_id")
      .notNull()
      .references(() => collectionTypes.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("collections_owner_idx").on(t.ownerId)],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    // category slug from the CollectionType's categories list
    category: text("category").notNull(),
    // display name, for retro built from manufacturer + model + variant
    title: text("title").notNull(),
    conditionGrade: integer("condition_grade"),
    conditionNotes: text("condition_notes"),
    // private always, never shared (spec 4.1)
    storageLocation: text("storage_location"),
    purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
    purchaseCurrency: currencyEnum("purchase_currency"),
    purchaseDate: date("purchase_date"),
    purchaseSource: text("purchase_source"),
    valueLow: numeric("value_low", { precision: 12, scale: 2 }),
    valueFair: numeric("value_fair", { precision: 12, scale: 2 }),
    valueHigh: numeric("value_high", { precision: 12, scale: 2 }),
    valueCurrency: currencyEnum("value_currency"),
    valueConfidence: valueConfidenceEnum("value_confidence").notNull().default("none"),
    valueUpdatedAt: timestamp("value_updated_at", { withTimezone: true }),
    // PriceObservation ids used for the estimate, split asking vs sold (spec 4.1)
    valueBasis: jsonb("value_basis"),
    valueManual: numeric("value_manual", { precision: 12, scale: 2 }),
    // depth 1 only: a child cannot have children (spec 4.3), enforced in the API layer
    parentItemId: uuid("parent_item_id").references((): AnyPgColumn => items.id, {
      onDelete: "set null",
    }),
    isPrivate: boolean("is_private").notNull().default(true),
    isFavorite: boolean("is_favorite").notNull().default(false),
    tags: text("tags").array().notNull().default([]),
    notes: text("notes"),
    // vertical fields, validated against collection_types.attributes_schema
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    aiConfidence: real("ai_confidence"),
    // generated from attributes so server-side filter and sort stay fast (spec 4.1)
    manufacturer: text("manufacturer").generatedAlwaysAs(
      (): ReturnType<typeof sql> => sql`(attributes->>'manufacturer')`,
    ),
    model: text("model").generatedAlwaysAs(
      (): ReturnType<typeof sql> => sql`(attributes->>'model')`,
    ),
    year: integer("year").generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`(case when attributes->>'year' ~ '^[0-9]+$' then (attributes->>'year')::integer else null end)`,
    ),
    searchText: tsvector("search_text").generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`(to_tsvector('simple',
          coalesce(title, '') || ' ' ||
          coalesce(notes, '') || ' ' ||
          coalesce(attributes->>'manufacturer', '') || ' ' ||
          coalesce(attributes->>'model', '') || ' ' ||
          coalesce(attributes->>'variant', '') || ' ' ||
          coalesce(attributes->>'platform', '') || ' ' ||
          coalesce(attributes->>'publisher', '') || ' ' ||
          coalesce(attributes->>'description', '')
        ) || array_to_tsvector(coalesce(tags, '{}')))`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("items_owner_idx").on(t.ownerId),
    index("items_collection_idx").on(t.collectionId),
    index("items_category_idx").on(t.category),
    index("items_manufacturer_idx").on(t.manufacturer),
    index("items_model_idx").on(t.model),
    index("items_year_idx").on(t.year),
    index("items_attributes_gin_idx").using("gin", t.attributes),
    index("items_search_gin_idx").using("gin", t.searchText),
  ],
);

export const itemPhotos = pgTable(
  "item_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    // up to 2000px on the long side, original is not kept (spec 4.2)
    url: text("url").notNull(),
    thumbUrl: text("thumb_url"),
    mediumUrl: text("medium_url"),
    angle: photoAngleEnum("angle"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("item_photos_item_idx").on(t.itemId)],
);

export const repairLogs = pgTable(
  "repair_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    description: text("description").notNull(),
    cost: numeric("cost", { precision: 12, scale: 2 }),
    costCurrency: currencyEnum("cost_currency"),
    performedBy: repairPerformedByEnum("performed_by").notNull().default("self"),
    // drives the follow-up insight rule (spec 10a)
    followUpDate: date("follow_up_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("repair_logs_item_idx").on(t.itemId)],
);

export const galleries = pgTable(
  "galleries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    description: jsonb("description").$type<LocalizedText>(),
    coverPhotoUrl: text("cover_photo_url"),
    visibility: galleryVisibilityEnum("visibility").notNull().default("private"),
    // groups arrive in phase 2, no FK yet
    groupId: uuid("group_id"),
    publicSlug: text("public_slug").unique(),
    sortMode: gallerySortModeEnum("sort_mode").notNull().default("manual"),
    // smart gallery: a saved filter instead of a manual list (spec 4.5)
    smartFilter: jsonb("smart_filter"),
    // public link hides value unless the owner turned this on (spec 8.1)
    showValue: boolean("show_value").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("galleries_owner_idx").on(t.ownerId)],
);

export const galleryItems = pgTable(
  "gallery_items",
  {
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.galleryId, t.itemId] })],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

export const priceObservations = pgTable(
  "price_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // either linked to an item, or standalone by manufacturer + model (spec 4.7)
    itemId: uuid("item_id").references(() => items.id, { onDelete: "cascade" }),
    manufacturer: text("manufacturer"),
    model: text("model"),
    source: priceObservationSourceEnum("source").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum("currency").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    url: text("url"),
    conditionHint: text("condition_hint"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_observations_item_idx").on(t.itemId)],
);

export const priceSources = pgTable("price_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectionTypeId: uuid("collection_type_id")
    .notNull()
    .references(() => collectionTypes.id),
  name: text("name").notNull(),
  type: priceSourceTypeEnum("type").notNull(),
  url: text("url"),
  // used to pick relevant sources per item, for example "Apple II" (spec 4.8)
  platformHint: text("platform_hint"),
  isActive: boolean("is_active").notNull().default(true),
  addedBy: uuid("added_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    // identification fields belong to the type's attributes, like on items (spec 4.7.1)
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    notes: text("notes"),
    targetPrice: numeric("target_price", { precision: 12, scale: 2 }),
    currency: currencyEnum("currency"),
    // 1..3, 1 is highest
    priority: integer("priority").notNull().default(2),
    status: wishlistStatusEnum("status").notNull().default("searching"),
    manufacturer: text("manufacturer").generatedAlwaysAs(
      (): ReturnType<typeof sql> => sql`(attributes->>'manufacturer')`,
    ),
    model: text("model").generatedAlwaysAs(
      (): ReturnType<typeof sql> => sql`(attributes->>'model')`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wishlist_items_owner_idx").on(t.ownerId)],
);

export const valueSnapshots = pgTable(
  "value_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    totalLow: numeric("total_low", { precision: 14, scale: 2 }),
    totalFair: numeric("total_fair", { precision: 14, scale: 2 }),
    totalHigh: numeric("total_high", { precision: 14, scale: 2 }),
    itemCount: integer("item_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("value_snapshots_collection_date_idx").on(t.collectionId, t.date)],
);

export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    kind: aiJobKindEnum("kind").notNull(),
    model: text("model"),
    input: jsonb("input"),
    rawOutput: jsonb("raw_output"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    durationMs: integer("duration_ms"),
    status: aiJobStatusEnum("status").notNull().default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_jobs_user_idx").on(t.userId)],
);

export const insights = pgTable(
  "insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "cascade" }),
    // rule key from spec 10a, for example missing_info, possible_duplicate
    rule: text("rule").notNull(),
    severity: insightSeverityEnum("severity").notNull(),
    message: jsonb("message").$type<LocalizedText>().notNull(),
    // deep link to an item or a filtered gallery
    action: text("action"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("insights_owner_dismissed_idx").on(t.ownerId, t.dismissedAt)],
);
