import { notificationsDal } from "@/server/dal/notifications.dal";
import {
  CreateNotificationInput,
  CreateNotificationSchema,
  GetNotificationsQuery,
} from "@/server/dto/notifications.dto";
import { ablyServer } from "@/lib/ably-server";
import type { NotificationEvent } from "@/server/dto/ably-events.dto";

export const notificationsService = {
  /**
   * Create a notification and publish real-time event via Ably
   */
  async createNotification(data: CreateNotificationInput) {
    const validated = CreateNotificationSchema.parse(data);
    const notification = await notificationsDal.create(validated);

    // Publish real-time notification event via Ably
    const notificationEvent: NotificationEvent = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt.toISOString(),
      isRead: false,
      data: notification.data as Record<string, unknown> | undefined,
    };
    await ablyServer.publishNotification(notification.userId, notificationEvent);

    return notification;
  },

  async getUserNotifications(userId: string, query: GetNotificationsQuery) {
    const { limit, offset, filter } = query;
    const { items, total } = await notificationsDal.getByUserId(
      userId,
      limit,
      offset,
      filter
    );
    const unreadCount = await notificationsDal.countUnread(userId);

    return {
      notifications: items,
      meta: {
        total,
        unreadCount,
        page: Math.floor(offset / limit) + 1,
        limit,
      },
    };
  },

  async getUnreadCount(userId: string) {
    return await notificationsDal.countUnread(userId);
  },

  async markAsRead(id: string, userId: string) {
    return await notificationsDal.markAsRead(id, userId);
  },

  async markAllAsRead(userId: string) {
    return await notificationsDal.markAllAsRead(userId);
  },
};
