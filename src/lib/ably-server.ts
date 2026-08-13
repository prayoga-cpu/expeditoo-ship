import Ably from "ably";

/**
 * Server-side Ably REST client for publishing events
 * Singleton pattern to reuse connection across requests
 *
 * CHANNEL STRATEGY (Optimized for Free Tier):
 * - Each user has ONE private channel: `user:{userId}:stream`
 * - All user-specific events go through this single channel
 * - Shared channels (conversations, listings) remain separate
 *
 * @see docs/plans/plan_ably_integration.md
 */
let ablyRestClient: Ably.Rest | null = null;

function getAblyRestClient(): Ably.Rest {
  if (!ablyRestClient) {
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      throw new Error("ABLY_API_KEY environment variable is not set");
    }
    ablyRestClient = new Ably.Rest(apiKey);
  }
  return ablyRestClient;
}

/**
 * Server-side Ably utilities for publishing real-time events
 * Events are published from the service layer after successful DB operations
 */
export const ablyServer = {
  /**
   * Publish an event to a channel with strict type safety.
   *
   * @param channelName - The channel to publish to
   * @param eventName - The event name
   * @param data - The payload (Must match expected type)
   */
  async publish<T>(channelName: string, eventName: string, data: T): Promise<void> {
    try {
      const client = getAblyRestClient();
      const channel = client.channels.get(channelName);
      await channel.publish(eventName, data);
    } catch (error) {
      console.error(`[Ably] Failed to publish ${eventName} to ${channelName}:`, error);
      // Don't throw - real-time failures shouldn't break the main flow
    }
  },

  // ========================================
  // SINGLE USER STREAM (Optimized)
  // All user-specific events through one channel
  // ========================================

  /**
   * Get user's private stream channel name
   */
  getUserStreamChannel(userId: string): string {
    return `user:${userId}:stream`;
  },

  /**
   * Publish to user's private stream - Message Badge Update
   * Event: badge:update
   */
  async publishMessageBadge(userId: string, data: unknown): Promise<void> {
    await this.publish(this.getUserStreamChannel(userId), "badge:update", data);
  },

  /**
   * Publish to user's private stream - Notification
   * Event: notification:new
   * NOTE: Should be called AFTER data events for proper ordering
   */
  async publishNotification(userId: string, data: unknown): Promise<void> {
    await this.publish(this.getUserStreamChannel(userId), "notification:new", data);
  },

  /**
   * Publish to user's private stream - Dashboard/Data Update
   * Event: data:update
   * Use this to signal client to refetch dashboard data
   */
  async publishDataUpdate(userId: string, data: { type: string; resourceId?: string }): Promise<void> {
    await this.publish(this.getUserStreamChannel(userId), "data:update", data);
  },

  /**
   * Publish to user's private stream - Outbid notification
   * Event: bid:outbid
   */
  async publishOutbid(userId: string, data: unknown): Promise<void> {
    await this.publish(this.getUserStreamChannel(userId), "bid:outbid", data);
  },

  // ========================================
  // SHARED CHANNELS (Multiple users can subscribe)
  // These don't scale with user count
  // ========================================

  /**
   * Publish a new message to a conversation channel
   * Channel: conversation:{conversationId}
   */
  async publishMessage(conversationId: string, data: unknown): Promise<void> {
    await this.publish(`conversation:${conversationId}`, "message:new", data);
  },

  /**
   * Publish a new bid to a listing's bid channel
   * Channel: listing:{listingId}:bids
   */
  async publishBid(listingId: string, data: unknown): Promise<void> {
    await this.publish(`listing:${listingId}:bids`, "bid:new", data);
  },

  /**
   * Publish auction ended event
   * Channel: listing:{listingId}:bids
   */
  async publishAuctionEnded(listingId: string, data: unknown): Promise<void> {
    await this.publish(`listing:${listingId}:bids`, "auction:ended", data);
  },

  /**
   * Publish order status update
   * Channel: order:{orderId}:status
   */
  async publishOrderStatus(orderId: string, data: unknown): Promise<void> {
    await this.publish(`order:${orderId}:status`, "order:status", data);
  },
};
