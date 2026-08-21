import { messagesDAL } from "@/server/dal/messages.dal";
import { reviewsService } from "./reviews.service";
import * as userService from "./user.service";
import {
  type SendMessageInput,
  type GetMessagesQuery,
  type GetConversationsQuery,
} from "@/server/dto/messages.dto";
import { nanoid } from "nanoid";
import { ablyServer } from "@/lib/ably-server";
import type { NewMessageEvent, MessageBadgeEvent } from "@/server/dto/ably-events.dto";

export const messagesService = {
  /**
   * Send a message (and create conversation if needed)
   * Publishes real-time events via Ably after successful DB operation
   * @param senderId - Sender user ID
   * @param input - Message input
   * @param senderInfo - Sender info from session (avoids DB query)
   */
  async sendMessage(
    senderId: string,
    input: SendMessageInput,
    senderInfo?: { name: string; image: string | null }
  ) {
    let conversationId = input.conversationId;
    let recipientId: string | null = null;

    // If no conversation ID, try to find or create one
    if (!conversationId) {
      if (!input.recipientId) {
        throw new Error("Recipient ID is required to start a new conversation");
      }
      recipientId = input.recipientId;

      // Check if conversation exists
      const existingConv = await messagesDAL.findConversation(
        senderId,
        input.recipientId,
        input.listingId
      );

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        // Create new conversation
        const newConv = await messagesDAL.createConversation(
          {
            id: nanoid(),
            listingId: input.listingId,
          },
          [senderId, input.recipientId]
        );
        conversationId = newConv.id;
      }
    } else {
      // Get recipient from existing conversation
      const conv = await messagesDAL.getConversationById(conversationId);
      if (conv) {
        const otherParticipant = conv.participants.find(p => p.user.id !== senderId);
        recipientId = otherParticipant?.user.id || null;

        // Auto-join if Admin replying to Support chat
        const isParticipant = conv.participants.some(p => p.user.id === senderId);
        if (!isParticipant && conv.type === 'SUPPORT') {
          const isAdmin = await userService.hasRole(senderId, 'admin');
          if (isAdmin) {
            await messagesDAL.addParticipant(conversationId, senderId);
          }
        }
      }
    }

    // Create the message
    const message = await messagesDAL.createMessage({
      id: nanoid(),
      conversationId: conversationId!,
      senderId,
      content: input.content,
    });

    // Fire-and-forget: Publish real-time events via Ably (don't await)
    // This significantly reduces response time since Ably publish is ~50-100ms
    const messageEvent: NewMessageEvent = {
      id: message.id,
      conversationId: conversationId!,
      senderId,
      content: input.content,
      createdAt: message.createdAt.toISOString(),
      isOwn: false,
      senderName: senderInfo?.name || undefined,
      senderImage: senderInfo?.image || null,
    };

    // Publish both events in parallel, fire-and-forget (no await)
    // Skip during tests since Ably mock is not configured
    if (process.env.NODE_ENV !== 'test') {
      Promise.all([
        ablyServer.publishMessage(conversationId!, messageEvent),
        recipientId
          ? messagesDAL.getUnreadCount(recipientId).then(unreadCount => {
            const badgeEvent: MessageBadgeEvent = {
              unreadCount,
              lastMessagePreview: input.content.substring(0, 50),
              conversationId: conversationId!,
            };
            return ablyServer.publishMessageBadge(recipientId!, badgeEvent);
          })
          : Promise.resolve(),
      ]).catch(err => {
        // Log but don't throw - real-time failures shouldn't break the main flow
        console.error('[messages.service] Ably publish error:', err);
      });
    }

    return {
      message,
      conversationId,
    };
  },

  /**
   * The caller's support thread, created on first use.
   *
   * Both entry points route through here — the web client's
   * `/api/chat/support` and the Expedion bridge's `/api/expedion/support` — so
   * a person who writes in from the Flutter app and again from the website
   * lands in one thread, which is the thread the admin inbox shows.
   *
   * Two simultaneous first-time calls can still race into two threads; there
   * is no unique constraint to lean on, and one duplicate on a first message
   * is cheaper than serialising every support request. `findSupportConversation`
   * takes the oldest, so the pair collapses back to one from then on.
   */
  async getOrCreateSupportConversation(userId: string) {
    const existing = await messagesDAL.findSupportConversation(userId);
    if (existing) return { conversationId: existing.id, created: false };

    const conversation = await messagesDAL.createConversation(
      { id: nanoid(), type: "SUPPORT", listingId: null },
      [userId]
    );

    return { conversationId: conversation.id, created: true };
  },

  /**
   * Get user's inbox
   */
  async getInbox(userId: string, query: GetConversationsQuery) {
    const offset = (query.page - 1) * query.limit;
    const conversations = await messagesDAL.getUserConversations(
      userId,
      query.limit,
      offset,
      query.search // Pass search query to DAL
    );

    // Transform for UI
    const items = conversations.map((conv) => {
      // Find the other participant
      const otherParticipant = conv.participants.find(
        (p) => p.user.id !== userId
      )?.user;

      // Check if unread
      const myParticipant = conv.participants.find((p) => p.user.id === userId);
      const isUnread =
        conv.lastMessageAt &&
        (!myParticipant?.lastReadAt ||
          new Date(conv.lastMessageAt) > new Date(myParticipant.lastReadAt));

      return {
        id: conv.id,
        otherParticipant,
        listing: conv.listing,
        lastMessageAt: conv.lastMessageAt,
        isUnread,
        lastMessage: conv.messages[0]?.content || null,
      };
    });

    return {
      items,
      page: query.page,
      limit: query.limit,
      // Total count would require another query, skipping for now
    };
  },

  /**
   * Get messages for a conversation
   */
  async getThread(
    userId: string,
    conversationId: string,
    query: GetMessagesQuery,
    { markRead = true }: { markRead?: boolean } = {}
  ) {
    // Verify participation
    const conversation = await messagesDAL.getConversationById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (p) => p.user.id === userId
    );

    // Allow Admin to participate in Support chats
    if (!isParticipant) {
      const isSupport = conversation.type === 'SUPPORT';
      if (isSupport) {
        const isAdmin = await userService.hasRole(userId, 'admin');
        if (!isAdmin) {
          throw new Error("Not authorized to view this conversation");
        }
        // Admin is allowed, proceed (optional: could auto-add participant here too)
      } else {
        throw new Error("Not authorized to view this conversation");
      }
    }

    // Find current user participant data to check for lastClearedAt
    const currentParticipant = conversation.participants.find(
      (p) => p.user.id === userId
    );

    // Find the other participant for read receipt calculation
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== userId
    );

    const offset = (query.page - 1) * query.limit;
    const rawMessages = await messagesDAL.getMessages(
      conversationId,
      query.limit,
      offset,
      currentParticipant?.lastClearedAt // Pass lastClearedAt to filter messages
    );

    // Mark as read when fetching first page.
    //
    // Suppressed for an admin viewing the account: this write is visible to
    // the *other* party as a read receipt, so it would tell them their message
    // had been read by someone who never read it, and it cannot be undone.
    if (query.page === 1 && markRead) {
      await messagesDAL.markAsRead(conversationId, userId);
    }

    // Transform messages with read receipt info
    const messages = rawMessages.reverse().map((msg) => ({
      ...msg,
      isOwn: msg.senderId === userId,
      // Read receipt: a message is "seen" if the other user has read it
      // (their lastReadAt is after the message createdAt)
      readByOther:
        msg.senderId === userId &&
        otherParticipant?.lastReadAt &&
        new Date(otherParticipant.lastReadAt) >= new Date(msg.createdAt),
    }));

    // Get stats for other participant (with graceful error handling)
    let otherParticipantData = null;
    if (otherParticipant) {
      try {
        const stats = await reviewsService.getUserStats(otherParticipant.user.id);
        otherParticipantData = {
          ...otherParticipant.user,
          rating: stats.average,
          reviewsCount: stats.total,
        };
      } catch (error) {
        // If reviews query fails, still return user data without stats
        console.error("[messages.service] Failed to get user stats:", error);
        otherParticipantData = {
          ...otherParticipant.user,
          rating: 0,
          reviewsCount: 0,
        };
      }
    }

    return {
      conversation,
      otherParticipant: otherParticipantData, // Add this for frontend
      messages,
      page: query.page,
      limit: query.limit,
    };
  },

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string) {
    return await messagesDAL.getUnreadCount(userId);
  },

  /**
   * Mark all conversations as seen (update lastReadAt for all)
   * Called when user visits the messages page
   */
  async markAllAsSeen(userId: string) {
    return await messagesDAL.markAllAsSeen(userId);
  },

  /**
   * Soft delete conversation for a user (Telegram-like behavior)
   * @param userId - User performing the delete
   * @param conversationId - Conversation to delete
   */
  async deleteConversation(userId: string, conversationId: string) {
    // Verify user is a participant
    const conversation = await messagesDAL.getConversationById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (p) => p.user.id === userId
    );
    if (!isParticipant) {
      throw new Error("Not authorized to delete this conversation");
    }

    return await messagesDAL.softDeleteConversation(conversationId, userId);
  },
};
