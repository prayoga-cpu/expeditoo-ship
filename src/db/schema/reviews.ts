import { pgTable, text, timestamp, integer, index, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { listings } from "./listings";
import { shipments } from "./shipments";

// ========================================
// Reviews Table
// ========================================

// Reviews run both ways between the two parties to a delivery
// (ROADMAP.md §8 Phase C). The role records which side wrote the review.
export const reviewRoleEnum = pgEnum("review_role", ["shipper", "carrier"]);

export type ReviewRole = typeof reviewRoleEnum.enumValues[number];

// ========================================
// Reviews Table
// ========================================

export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    listingId: text("listing_id").references(() => listings.id, {
      onDelete: "cascade",
    }),
    shipmentId: text("shipment_id").references(() => shipments.id, {
      onDelete: "cascade",
    }),
    role: reviewRoleEnum("role").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("review_target_idx").on(table.targetUserId),
    index("review_author_idx").on(table.authorId),
    index("review_listing_idx").on(table.listingId),
    index("review_shipment_idx").on(table.shipmentId),
  ]
);

// ========================================
// Relations
// ========================================

export const reviewsRelations = relations(reviews, ({ one }) => ({
  targetUser: one(user, {
    fields: [reviews.targetUserId],
    references: [user.id],
    relationName: "targetUserToReviews",
  }),
  author: one(user, {
    fields: [reviews.authorId],
    references: [user.id],
    relationName: "authorToReviews",
  }),
  listing: one(listings, {
    fields: [reviews.listingId],
    references: [listings.id],
  }),
  shipment: one(shipments, {
    fields: [reviews.shipmentId],
    references: [shipments.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;
