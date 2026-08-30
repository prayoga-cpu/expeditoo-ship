/**
 * Messages Client API
 * Wrapper for REST API calls to messages endpoints
 */

import type { ThreadOfferContext, ThreadOfferView } from "../types";

/** Thrown so a caller can branch on the server's code, not its wording. */
export class ThreadOfferApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly issues?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = "ThreadOfferApiError";
  }
}

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json();
  if (!data.success) {
    throw new ThreadOfferApiError(
      data.error?.code ?? "UNKNOWN",
      data.error?.message ?? fallback,
      data.error?.issues
    );
  }
  return data.data;
}

export interface SubmitThreadOfferInput {
  priceCents: number;
  pickupDay: string;
  pickupSlot: "morning" | "afternoon" | "evening";
  deliveryLeadDays: number;
  tzOffset: number;
  vehicleId?: string;
  message?: string;
}

// Types for API responses
export interface ConversationResponse {
  id: string;
  otherParticipant: {
    id: string;
    name: string;
    image: string | null;
  } | null;
  listing: {
    id: string;
    title: string;
  } | null;
  lastMessageAt: string | null;
  lastMessage: string | null;
  isUnread: boolean;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  isOwn: boolean; // Whether this message was sent by the current user
  readByOther: boolean; // Read receipt: whether the other participant has read this message
  sender: {
    id: string;
    name: string;
    image: string | null;
  };
  /** Present when this message carries a formal price. */
  threadOffer?: ThreadOfferView | null;
}

export interface ThreadResponse {
  conversation: {
    id: string;
    listingId: string | null;
    participants: Array<{
      userId: string;
      user: {
        id: string;
        name: string;
        image: string | null;
      };
    }>;
    listing: {
      id: string;
      title: string;
      // The DAL returns this relation as `photos`. It was read as `images`
      // for as long as the thread has existed, so the header always fell
      // back to the placeholder.
      photos?: Array<{ url: string }>;
    } | null;
  };
  otherParticipant: {
    id: string;
    name: string;
    image: string | null;
    rating?: number;
    reviewsCount?: number;
  } | null;
  messages: MessageResponse[];
  offerContext: ThreadOfferContext | null;
  page: number;
  limit: number;
}

export interface SendMessageInput {
  recipientId?: string;
  conversationId?: string;
  content: string;
  listingId?: string;
}

// API functions
export const messagesApi = {
  /**
   * Get user's inbox (list of conversations)
   * @param page - Page number for pagination
   * @param limit - Number of items per page
   * @param search - Optional search query (by participant name or listing title)
   */
  async getConversations(
    page = 1,
    limit = 20,
    search?: string
  ): Promise<ConversationResponse[]> {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search) params.set("search", search);

    const res = await fetch(`/api/messages/conversations?${params.toString()}`);
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to fetch conversations");
    }
    return data.data.items;
  },

  /**
   * Get messages for a specific conversation
   */
  async getThread(
    conversationId: string,
    page = 1,
    limit = 50
  ): Promise<ThreadResponse> {
    const res = await fetch(
      `/api/messages/conversations/${conversationId}?page=${page}&limit=${limit}`
    );
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to fetch messages");
    }
    return data.data;
  },

  /**
   * Send a message (creates conversation if needed)
   */
  async sendMessage(
    input: SendMessageInput
  ): Promise<{ message: MessageResponse; conversationId: string }> {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to send message");
    }
    return data.data;
  },

  /**
   * Get unread message count
   */
  async getUnreadCount(): Promise<number> {
    const res = await fetch("/api/messages/unread-count");
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to fetch unread count");
    }
    return data.data.count;
  },

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    const res = await fetch(`/api/messages/${messageId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to delete message");
    }
  },

  /**
   * Delete a conversation (Telegram-like soft delete)
   * - Hides conversation from inbox
   * - Clears message history
   * - Conversation reappears when new message arrives (but old history stays hidden)
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const res = await fetch(`/api/messages/conversations/${conversationId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to delete conversation");
    }
  },

  /**
   * Mark all conversations as seen (visited messages page)
   * This clears the unread badge from the notification bell
   */
  async markAllAsSeen(): Promise<number> {
    const res = await fetch("/api/messages/mark-seen", {
      method: "POST",
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to mark as seen");
    }
    return data.data.updatedCount;
  },

  /**
   * Mark a specific conversation as read
   * Lightweight endpoint - doesn't fetch messages
   */
  async markAsRead(conversationId: string): Promise<void> {
    const res = await fetch(`/api/conversations/${conversationId}/read`, {
      method: "POST",
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to mark as read");
    }
  },

  /**
   * Create or resume a support chat
   */
  async createSupportChat(): Promise<{ chatRoomId: string; exists: boolean }> {
    const res = await fetch("/api/chat/support", {
      method: "POST",
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to create support chat");
    }
    return data.data;
  },

  /**
   * Put a price on the table inside a thread.
   *
   * The listing is never sent: the server reads it from the conversation, the
   * same reasoning that keeps `origin` off the create-listing contract.
   */
  async submitOffer(
    conversationId: string,
    input: SubmitThreadOfferInput
  ): Promise<{ threadOffer: ThreadOfferView; message: MessageResponse }> {
    const res = await fetch(
      `/api/messages/conversations/${conversationId}/offer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
    return unwrap(res, "Failed to send offer");
  },

  async acceptOffer(
    threadOfferId: string
  ): Promise<{ threadOffer: ThreadOfferView; shipmentId: string | null }> {
    const res = await fetch(`/api/messages/offers/${threadOfferId}/accept`, {
      method: "POST",
    });
    return unwrap(res, "Failed to accept offer");
  },

  async declineOffer(
    threadOfferId: string
  ): Promise<{ threadOffer: ThreadOfferView }> {
    const res = await fetch(`/api/messages/offers/${threadOfferId}/decline`, {
      method: "POST",
    });
    return unwrap(res, "Failed to decline offer");
  },

  async withdrawOffer(
    threadOfferId: string
  ): Promise<{ threadOffer: ThreadOfferView }> {
    const res = await fetch(`/api/messages/offers/${threadOfferId}/withdraw`, {
      method: "POST",
    });
    return unwrap(res, "Failed to withdraw offer");
  },
};
