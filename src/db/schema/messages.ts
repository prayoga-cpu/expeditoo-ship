import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { listings } from "./listings";
import { threadOffers } from "./thread-offers";

// ========================================
// Conversations Table
// ========================================

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["LISTING", "SUPPORT"] })
    .default("LISTING")
    .notNull(), // Chat type: listing-related or support
  listingId: text("listing_id").references(() => listings.id, {
    onDelete: "set null",
  }), // Optional context (null for support chats)
  lastMessageAt: timestamp("last_message_at"), // Nullable initially
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ========================================
// Conversation Participants Table
// ========================================

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    // Soft delete: when user "deletes" a conversation, only their view is removed
    // The other participant can still see the conversation
    deletedAt: timestamp("deleted_at"),
    // When user clears history, we only show messages after this date
    lastClearedAt: timestamp("last_cleared_at"),
  },
  (table) => [
    index("participant_conversation_idx").on(table.conversationId),
    index("participant_user_idx").on(table.userId),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(), // Text only
    attachmentUrl: text("attachment_url"), // Optional image/file
    /**
     * The formal price this message carries, if any.
     *
     * `threadOfferId IS NOT NULL` is the whole discriminator - there is no
     * message-kind enum and no payload column. Price, dates and status are read
     * from the joined row at render time, so a withdrawn or awarded offer shows
     * its current state without the message ever being rewritten.
     *
     * SET NULL, not cascade: the chat line degrades to its plain-text summary
     * rather than the conversation losing a turn.
     * See docs/specs/thread_offer_spec.md §3.2.
     */
    threadOfferId: text("thread_offer_id").references(() => threadOffers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    isRead: boolean("is_read").default(false).notNull(),
  },
  (table) => [
    index("message_conversation_idx").on(table.conversationId),
    index("message_sender_idx").on(table.senderId),
  ]
);

// ========================================
// Relations
// ========================================

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    listing: one(listings, {
      fields: [conversations.listingId],
      references: [listings.id],
    }),
    participants: many(conversationParticipants),
    messages: many(messages),
  })
);

export const conversationParticipantsRelations = relations(
  conversationParticipants,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationParticipants.conversationId],
      references: [conversations.id],
    }),
    user: one(user, {
      fields: [conversationParticipants.userId],
      references: [user.id],
    }),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(user, {
    fields: [messages.senderId],
    references: [user.id],
  }),
  threadOffer: one(threadOffers, {
    fields: [messages.threadOfferId],
    references: [threadOffers.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

export type ConversationParticipant =
  typeof conversationParticipants.$inferSelect;
export type InsertConversationParticipant =
  typeof conversationParticipants.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
