import { db } from "@/db";
import {
  conversations,
  conversationParticipants,
  messages,
  type InsertConversation,
  type InsertMessage,
} from "@/db/schema/messages";
import { eq, and, sql, inArray, gt, asc } from "drizzle-orm";
import { nanoid } from "nanoid";

export const messagesDAL = {
  /**
   * Create a new conversation
   */
  async createConversation(
    data: InsertConversation,
    participantIds: string[]
  ) {
    return await db.transaction(async (tx) => {
      // 1. Create conversation
      const [newConv] = await tx
        .insert(conversations)
        .values(data)
        .returning();

      // 2. Add participants
      const participants = participantIds.map((userId) => ({
        id: nanoid(),
        conversationId: newConv.id,
        userId,
        joinedAt: new Date(),
      }));

      await tx.insert(conversationParticipants).values(participants);

      return newConv;
    });
  },

  /**
   * Find existing conversation between two users (optionally for a listing)
   */
  async findConversation(user1Id: string, user2Id: string, listingId?: string) {
    // This is a bit complex in SQL/Drizzle without raw queries, 
    // but we need to find a conversation where BOTH users are participants

    // 1. Get conversation IDs for user1
    const user1Convs = await db
      .select({ id: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, user1Id));

    const user1ConvIds = user1Convs.map(c => c.id);

    if (user1ConvIds.length === 0) return null;

    // 2. Check if user2 is in any of those conversations
    const commonConvs = await db
      .select({
        id: conversationParticipants.conversationId,
        listingId: conversations.listingId
      })
      .from(conversationParticipants)
      .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
      .where(and(
        eq(conversationParticipants.userId, user2Id),
        inArray(conversationParticipants.conversationId, user1ConvIds),
        listingId ? eq(conversations.listingId, listingId) : undefined
      ))
      .limit(1);

    return commonConvs[0] || null;
  },

  /**
   * Create a message
   */
  async createMessage(data: InsertMessage) {
    return await db.transaction(async (tx) => {
      // 1. Insert message
      const [newMessage] = await tx.insert(messages).values(data).returning();

      // 2. Update conversation lastMessageAt
      await tx
        .update(conversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(conversations.id, data.conversationId));

      // 3. Reset deletedAt for all participants (un-delete conversation when new message arrives)
      await tx
        .update(conversationParticipants)
        .set({ deletedAt: null })
        .where(eq(conversationParticipants.conversationId, data.conversationId));

      return newMessage;
    });
  },

  /**
   * Get user conversations with last message and other participant
   * @param userId - Current user ID
   * @param limit - Number of conversations to return
   * @param offset - Offset for pagination
   * @param search - Optional search query (filters by participant name or listing title)
   */
  async getUserConversations(
    userId: string,
    limit: number,
    offset: number,
    search?: string
  ) {
    // Get conversations where user is a participant AND has not soft-deleted
    const userConvs = await db.query.conversationParticipants.findMany({
      where: and(
        eq(conversationParticipants.userId, userId),
        // Filter out soft-deleted conversations (deletedAt is null means not deleted)
        sql`${conversationParticipants.deletedAt} IS NULL`
      ),
      with: {
        conversation: {
          with: {
            participants: {
              with: {
                user: {
                  columns: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
            listing: {
              columns: {
                id: true,
                title: true,
              },
              with: {
                photos: {
                  limit: 1,
                  orderBy: (photos, { asc }) => [asc(photos.order)],
                },
              },
            },
            messages: {
              columns: {
                content: true,
                createdAt: true,
              },
              orderBy: (messages, { desc }) => [desc(messages.createdAt)],
              limit: 1,
            },
          },
        },
      },
      orderBy: (cp, { desc }) => [desc(cp.lastReadAt)], // Ideally order by conversation.lastMessageAt
    });

    // Map and sort by lastMessageAt
    let conversations = userConvs
      .map((uc) => uc.conversation)
      .sort((a, b) => {
        const dateA = a.lastMessageAt
          ? new Date(a.lastMessageAt).getTime()
          : 0;
        const dateB = b.lastMessageAt
          ? new Date(b.lastMessageAt).getTime()
          : 0;
        return dateB - dateA;
      });

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      conversations = conversations.filter((conv) => {
        // Search in participant names (excluding current user)
        const participantMatch = conv.participants.some(
          (p) =>
            p.user.id !== userId &&
            p.user.name?.toLowerCase().includes(searchLower)
        );

        // Search in listing title
        const listingMatch = conv.listing?.title
          ?.toLowerCase()
          .includes(searchLower);

        return participantMatch || listingMatch;
      });
    }

    // Apply pagination after filtering
    return conversations.slice(offset, offset + limit);
  },

  /**
   * Get messages for a conversation
   * Optionally filters by lastClearedAt if provided
   */
  async getMessages(conversationId: string, limit: number, offset: number, lastClearedAt?: Date | null) {
    return await db.query.messages.findMany({
      where: and(
        eq(messages.conversationId, conversationId),
        lastClearedAt ? gt(messages.createdAt, lastClearedAt) : undefined
      ),
      orderBy: (msgs, { desc }) => [desc(msgs.createdAt)],
      limit,
      offset,
      with: {
        sender: {
          columns: {
            id: true,
            name: true,
            image: true,
          }
        }
      }
    });
  },

  /**
   * Get conversation details
   */
  async getConversationById(conversationId: string) {
    return await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        participants: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                image: true,
              }
            }
          }
        },
        listing: {
          with: {
            photos: {
              limit: 1,
            }
          }
        }
      }
    });
  },

  /**
   * Mark conversation as read for a user
   */
  async markAsRead(conversationId: string, userId: string) {
    // Update participant's lastReadAt
    await db
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ));

    // Also mark messages as read (optional, but good for stats)
    // In a real app, we might only mark messages sent by others
    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(
        eq(messages.conversationId, conversationId),
        sql`${messages.senderId} != ${userId}`
      ));
  },

  /**
   * Get unread count for user
   * Excludes soft-deleted conversations
   */
  async getUnreadCount(userId: string) {
    // Count conversations where lastMessageAt > lastReadAt
    // Excludes conversations that the user has soft-deleted
    // AND ensures there is at least one message in the conversation (lastMessageAt is not null)

    const result = await db.execute(sql`
      SELECT COUNT(DISTINCT c.id) as count
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = ${userId}
      AND cp.deleted_at IS NULL
      AND c.last_message_at IS NOT NULL
      AND (cp.last_read_at IS NULL OR c.last_message_at > cp.last_read_at)
    `);

    return Number(result[0]?.count || 0);
  },

  /**
   * Mark all conversations as seen for a user
   * Updates lastReadAt to current time for all non-deleted participant entries
   * Returns 0 if user has no active conversations (graceful handling)
   */
  async markAllAsSeen(userId: string) {
    try {
      const result = await db
        .update(conversationParticipants)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(conversationParticipants.userId, userId),
            sql`${conversationParticipants.deletedAt} IS NULL`
          )
        )
        .returning({ id: conversationParticipants.id });

      return result.length;
    } catch (error) {
      // Log error but return 0 gracefully - this is a non-critical operation
      console.error('[markAllAsSeen] Database error:', error);
      return 0;
    }
  },

  /**
   * Add a participant to a conversation
   */
  async addParticipant(conversationId: string, userId: string) {
    const existing = await db
      .select()
      .from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ))
      .limit(1);

    if (existing.length > 0) return existing[0];

    const [participant] = await db
      .insert(conversationParticipants)
      .values({
        id: nanoid(),
        conversationId,
        userId,
        joinedAt: new Date(),
      })
      .returning();

    return participant;
  },

  /**
   * Soft delete conversation for a user (Telegram-like behavior)
   * - Sets deletedAt to hide conversation from inbox
   * - Sets lastClearedAt so old messages are hidden when conversation reappears
   * - The other participant can still see the conversation
   * - When a new message arrives, deletedAt is reset but lastClearedAt remains
   * @param conversationId - Conversation to delete
   * @param userId - User performing the delete
   */
  async softDeleteConversation(conversationId: string, userId: string) {
    const now = new Date();

    const result = await db
      .update(conversationParticipants)
      .set({
        deletedAt: now,
        lastClearedAt: now, // Clear history up to this point
      })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      )
      .returning({ id: conversationParticipants.id });

    return result.length > 0;
  },

  /**
   * The caller's own support thread, if they already have one.
   *
   * Joins on `conversations.type` rather than reading the type off whichever
   * participant row comes back first. That shortcut is what made the web
   * client open a *second* support conversation for anyone who had ever
   * messaged a carrier — their first participant row is a LISTING chat, the
   * type check fails, and a fresh thread is created on every visit. The admin
   * inbox then shows one person as several unrelated conversations.
   *
   * Oldest wins, so where duplicates already exist both products converge on
   * the thread that holds the history.
   */
  async findSupportConversation(userId: string) {
    const [existing] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .innerJoin(
        conversationParticipants,
        eq(conversationParticipants.conversationId, conversations.id)
      )
      .where(
        and(
          eq(conversations.type, "SUPPORT"),
          eq(conversationParticipants.userId, userId)
        )
      )
      .orderBy(asc(conversations.createdAt))
      .limit(1);

    return existing ?? null;
  },
};
