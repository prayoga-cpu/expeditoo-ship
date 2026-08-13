import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { listings } from "./listings";

// ========================================
// Bids Table
// ========================================

export const bids = pgTable(
  "bids",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    bidderId: text("bidder_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("bid_listing_idx").on(table.listingId),
    index("bid_bidder_idx").on(table.bidderId),
  ]
);

// ========================================
// Relations
// ========================================

export const bidsRelations = relations(bids, ({ one }) => ({
  listing: one(listings, {
    fields: [bids.listingId],
    references: [listings.id],
  }),
  bidder: one(user, {
    fields: [bids.bidderId],
    references: [user.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Bid = typeof bids.$inferSelect;
export type InsertBid = typeof bids.$inferInsert;
