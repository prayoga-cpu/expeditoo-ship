import { db } from "@/db";
import { notifications } from "@/db/schema/notifications";
import { and, count, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

// Use schema type, not DTO (per rules.md - DAL cannot import DTO)
type InsertNotification = typeof notifications.$inferInsert;

export const notificationsDal = {
  async create(data: Omit<InsertNotification, "id" | "isRead" | "createdAt">) {
    const id = nanoid();
    const [result] = await db.insert(notifications).values({ id, ...data }).returning();
    return result;
  },

  async getByUserId(
    userId: string,
    limit: number = 10,
    offset: number = 0,
    filter: "all" | "unread" = "all"
  ) {
    const conditions = [eq(notifications.userId, userId)];

    if (filter === "unread") {
      conditions.push(eq(notifications.isRead, false));
    }

    const items = await db.query.notifications.findMany({
      where: and(...conditions),
      orderBy: [desc(notifications.createdAt)],
      limit,
      offset,
    });

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(...conditions));

    return {
      items,
      total: countResult?.count ?? 0,
    };
  },

  async countUnread(userId: string) {
    const [result] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );
    return result?.count ?? 0;
  },

  async markAsRead(id: string, userId: string) {
    const [result] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result;
  },

  async markAllAsRead(userId: string) {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      )
      .returning();
    return result.length;
  },
};
