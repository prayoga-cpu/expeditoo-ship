import { z } from "zod";

/**
 * Ably Event DTOs (Zod Schemas)
 * All real-time event payloads must be validated with these schemas
 *
 * Server-Side: Validate before publishing
 * Client-Side: Validate before updating cache
 *
 * @see docs/plans/plan_ably_integration.md
 */

// ============================================
// MESSAGE EVENTS
// ============================================

export const newMessageEventSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  content: z.string(),
  createdAt: z.string(),
  isOwn: z.boolean(),
  senderName: z.string().optional(),
  senderImage: z.string().nullable().optional(),
});

export type NewMessageEvent = z.infer<typeof newMessageEventSchema>;

export const messageBadgeEventSchema = z.object({
  unreadCount: z.number(),
  lastMessagePreview: z.string().optional(),
  conversationId: z.string().optional(),
});

export type MessageBadgeEvent = z.infer<typeof messageBadgeEventSchema>;

export const messageReadEventSchema = z.object({
  conversationId: z.string(),
  readBy: z.string(),
  readAt: z.string(),
});

export type MessageReadEvent = z.infer<typeof messageReadEventSchema>;

// ============================================
// NOTIFICATION EVENTS
// ============================================

export const notificationEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  createdAt: z.string(),
  isRead: z.boolean().default(false),
  data: z.record(z.unknown()).optional(),
});

export type NotificationEvent = z.infer<typeof notificationEventSchema>;

export const notificationBadgeEventSchema = z.object({
  unreadCount: z.number(),
});

export type NotificationBadgeEvent = z.infer<typeof notificationBadgeEventSchema>;

// ============================================
// AUCTION/BID EVENTS
// ============================================

export const newBidEventSchema = z.object({
  bidId: z.string(),
  listingId: z.string(),
  bidderId: z.string(),
  bidderName: z.string().nullable(),
  bidderImage: z.string().nullable(),
  amount: z.number(), // In cents
  createdAt: z.string(),
  isHighestBid: z.boolean(),
});

export type NewBidEvent = z.infer<typeof newBidEventSchema>;

export const outbidEventSchema = z.object({
  listingId: z.string(),
  listingTitle: z.string(),
  yourBidAmount: z.number(), // In cents
  newHighestBid: z.number(), // In cents
  newHighestBidderId: z.string(),
});

export type OutbidEvent = z.infer<typeof outbidEventSchema>;

export const auctionEndedEventSchema = z.object({
  listingId: z.string(),
  winnerId: z.string().nullable(),
  winningBid: z.number().nullable(), // In cents
  status: z.enum(["sold", "ended", "cancelled"]),
});

export type AuctionEndedEvent = z.infer<typeof auctionEndedEventSchema>;

// ============================================
// ORDER EVENTS
// ============================================

export const orderStatusEventSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  previousStatus: z.string().optional(),
  updatedAt: z.string(),
  message: z.string().optional(),
});

export type OrderStatusEvent = z.infer<typeof orderStatusEventSchema>;

// ============================================
// CONVERSATION EVENTS
// ============================================

export const conversationUpdateEventSchema = z.object({
  conversationId: z.string(),
  lastMessage: z.object({
    content: z.string(),
    senderId: z.string(),
    createdAt: z.string(),
  }),
  unreadCount: z.number(),
});

export type ConversationUpdateEvent = z.infer<typeof conversationUpdateEventSchema>;
