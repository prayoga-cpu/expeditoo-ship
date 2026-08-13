import {
    pgTable,
    text,
    timestamp,
    integer,
    index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";

// ========================================
// Search Analytics Table
// ========================================

export const searchAnalytics = pgTable(
    "search_analytics",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
        query: text("query").notNull(),
        resultsCount: integer("results_count").default(0).notNull(),
        category: text("category"),
        filters: text("filters"), // JSON string of applied filters
        clickedListingId: text("clicked_listing_id"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("search_query_idx").on(table.query),
        index("search_user_idx").on(table.userId),
        index("search_created_idx").on(table.createdAt),
    ]
);

// ========================================
// Relations
// ========================================

export const searchAnalyticsRelations = relations(searchAnalytics, ({ one }) => ({
    user: one(user, {
        fields: [searchAnalytics.userId],
        references: [user.id],
    }),
}));

// ========================================
// Type Exports
// ========================================

export type SearchAnalytic = typeof searchAnalytics.$inferSelect;
export type InsertSearchAnalytic = typeof searchAnalytics.$inferInsert;
