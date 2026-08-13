import { NotificationDto } from "@/server/dto/notifications.dto";

// Standard API response types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface NotificationsResponse {
  notifications: NotificationDto[];
  meta: { total: number; unreadCount: number; page: number; limit: number };
}

export const getNotifications = async (
  limit = 10,
  offset = 0,
  filter = "all"
): Promise<NotificationsResponse> => {
  const res = await fetch(
    `/api/notifications?limit=${limit}&offset=${offset}&filter=${filter}`
  );
  if (!res.ok) throw new Error("Failed to fetch notifications");
  const json = (await res.json()) as ApiResponse<NotificationsResponse>;
  if (!json.success) throw new Error("Failed to fetch notifications");
  return json.data;
};

export const getUnreadCount = async (): Promise<number> => {
  const res = await fetch("/api/notifications/unread-count");
  if (!res.ok) throw new Error("Failed to fetch unread count");
  const json = (await res.json()) as ApiResponse<{ count: number }>;
  if (!json.success) throw new Error("Failed to fetch unread count");
  return json.data.count;
};

export const markAsRead = async (id: string): Promise<void> => {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error("Failed to mark as read");
  const json = await res.json();
  if (!json.success) throw new Error("Failed to mark as read");
};

export const markAllAsRead = async (): Promise<number> => {
  const res = await fetch("/api/notifications/read-all", {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to mark all as read");
  const json = (await res.json()) as ApiResponse<{ updatedCount: number }>;
  if (!json.success) throw new Error("Failed to mark all as read");
  return json.data.updatedCount;
};

export const deleteNotification = async (id: string): Promise<void> => {
  const res = await fetch(`/api/notifications/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete notification");
  const json = await res.json();
  if (!json.success) throw new Error("Failed to delete notification");
};

