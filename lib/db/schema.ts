// Drizzle schema mirroring the Neon DB that inventory_sync writes to.
// Authoritative schema definition lives in the Python side
// (inventory_sync/persistence/schema.py) — this file is read-only from
// the dashboard's perspective, except for `users` which is dashboard-owned.

import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// --- dashboard-owned tables ---

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(), // 'admin' | 'customer'
    customerId: text("customer_id"), // NULL for admin
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ix_users_customer_id").on(t.customerId)],
);

// --- inventory-sync owned tables (read-only views from the dashboard) ---

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  syncIntervalMinutes: integer("sync_interval_minutes").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  configJson: text("config_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const syncRuns = pgTable(
  "sync_runs",
  {
    runId: text("run_id").primaryKey(),
    customerId: text("customer_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    itemsChecked: integer("items_checked").notNull(),
    changesPlannedCount: integer("changes_planned_count").notNull(),
    changesAppliedCount: integer("changes_applied_count").notNull(),
    errorsCount: integer("errors_count").notNull(),
    vendorMissingCount: integer("vendor_missing_count").notNull(),
    durationSeconds: numeric("duration_seconds"),
  },
  (t) => [
    index("ix_sync_runs_started_at").on(t.startedAt),
    index("ix_sync_runs_customer_id").on(t.customerId),
  ],
);

export const syncRunChanges = pgTable("sync_run_changes", {
  id: integer("id").primaryKey(),
  runId: text("run_id").notNull(),
  sku: text("sku").notNull(),
  kind: text("kind").notNull(),
  newStock: integer("new_stock"),
  reason: text("reason"),
  applied: boolean("applied").notNull(),
});

export const syncRunErrors = pgTable("sync_run_errors", {
  id: integer("id").primaryKey(),
  runId: text("run_id").notNull(),
  sku: text("sku"),
  message: text("message").notNull(),
  whenAt: timestamp("when_at", { withTimezone: true }).notNull(),
});

export const itemState = pgTable(
  "item_state",
  {
    customerId: text("customer_id").notNull(),
    vendorName: text("vendor_name").notNull(),
    stateKey: text("state_key").notNull(),
    sku: text("sku").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.vendorName, t.stateKey, t.sku] })],
);

// store_products is inventory-sync owned, EXCEPT the dashboard's pending-review
// flow writes `approved` / `approved_at` (Neon-only; the Python sync job holds
// the Shopify token and later flips draft→active in Shopify for approved rows).
export const storeProducts = pgTable(
  "store_products",
  {
    customerId: text("customer_id").notNull(),
    sku: text("sku").notNull(),
    handle: text("handle"),
    title: text("title"),
    storeProductId: text("store_product_id"),
    // Lifecycle columns (added Python-side for the draft → approve → activate flow).
    status: text("status").notNull().default("active"), // 'draft' | 'active'
    approved: boolean("approved").notNull().default(true),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    isNewCollection: boolean("is_new_collection").notNull().default(false),
    needsReview: boolean("needs_review").notNull().default(false),
    needsReviewReason: varchar("needs_review_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.sku] })],
);

export const vendorSnapshotCache = pgTable(
  "vendor_snapshot_cache",
  {
    vendorName: text("vendor_name").notNull(),
    vendorProductId: text("vendor_product_id").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    isAvailable: boolean("is_available").notNull(),
    stockCount: integer("stock_count"),
    rawAvailability: text("raw_availability"),
    name: text("name"),
    price: numeric("price"),
    currency: varchar("currency"),
    imageUrl: text("image_url"),
  },
  (t) => [primaryKey({ columns: [t.vendorName, t.vendorProductId] })],
);
