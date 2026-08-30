import { messagesDAL } from "@/server/dal/messages.dal";
import { ablyServer } from "@/lib/ably-server";
import type {
  NewMessageEvent,
  MessageBadgeEvent,
} from "@/server/dto/ably-events.dto";

/**
 * Announce a new message on Ably.
 *
 * Lifted out of `messagesService.sendMessage` unchanged so an offer sent from a
 * thread reaches the other side by exactly the same path a sentence does. It
 * lives in its own module rather than on `messages.service` because that
 * service imports `thread-offers.service`, and putting the publisher there
 * would close the loop into an import cycle.
 *
 * Fire-and-forget: an Ably outage must not fail a write that already committed.
 */
export function publishNewMessage({
  conversationId,
  senderId,
  recipientId,
  message,
  content,
  senderInfo,
  threadOfferId,
}: {
  conversationId: string;
  senderId: string;
  recipientId: string | null;
  message: { id: string; createdAt: Date };
  content: string;
  senderInfo?: { name: string; image: string | null };
  /** Set when the message carries an offer, so the client refetches the
   *  thread rather than synthesising a bubble from a payload it lacks. */
  threadOfferId?: string | null;
}) {
  const messageEvent: NewMessageEvent = {
    id: message.id,
    conversationId,
    senderId,
    content,
    createdAt: message.createdAt.toISOString(),
    isOwn: false,
    senderName: senderInfo?.name || undefined,
    senderImage: senderInfo?.image || null,
    threadOfferId: threadOfferId ?? null,
  };

  // Skip during tests since the Ably mock is not configured.
  if (process.env.NODE_ENV === "test") return;

  Promise.all([
    ablyServer.publishMessage(conversationId, messageEvent),
    recipientId
      ? messagesDAL.getUnreadCount(recipientId).then((unreadCount) => {
          const badgeEvent: MessageBadgeEvent = {
            unreadCount,
            lastMessagePreview: content.substring(0, 50),
            conversationId,
          };
          return ablyServer.publishMessageBadge(recipientId, badgeEvent);
        })
      : Promise.resolve(),
  ]).catch((err) => {
    // Log but don't throw - real-time failures shouldn't break the main flow
    console.error("[message-publish] Ably publish error:", err);
  });
}
