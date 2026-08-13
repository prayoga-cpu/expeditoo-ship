import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";

// ========================================
// Notifications Table
// ========================================

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    type: text("type").notNull(), // e.g., "bid_placed", "shipment_update"
    title: text("title").notNull(),
    message: text("message").notNull(),
    linkUrl: text("link_url"), // Optional link for notification action
    data: jsonb("data"), // Additional context (e.g., { listingId: "..." })

    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_user_idx").on(table.userId),
    index("notification_read_idx").on(table.isRead),
  ]
);

// ========================================
// Relations
// ========================================

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
