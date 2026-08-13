import {
  pgTable,
  text,
  timestamp,
  boolean,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";

// ========================================
// Addresses Table
// ========================================

export const addresses = pgTable(
  "addresses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // "Home", "Office", etc.
    street: text("street").notNull(),
    city: text("city").notNull(),
    zip: text("zip").notNull(),
    country: text("country").notNull(),
    details: text("details"), // Floor, apartment number, building color, etc.
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("addresses_userId_idx").on(table.userId),
    index("addresses_isDefault_idx").on(table.userId, table.isDefault),
  ]
);

// ========================================
// Relations
// ========================================

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(user, {
    fields: [addresses.userId],
    references: [user.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Address = typeof addresses.$inferSelect;
export type InsertAddress = typeof addresses.$inferInsert;
