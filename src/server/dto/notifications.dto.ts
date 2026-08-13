import { z } from "zod";

export const NotificationTypeEnum = z.enum([
  "offer",
  "listing",
  "message",
  "delivery",
  "review",
  "payment",
]);

export type NotificationType = z.infer<typeof NotificationTypeEnum>;

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationTypeEnum,
  title: z.string(),
  message: z.string(), // Changed from description to match DB schema
  data: z.unknown().optional().nullable(),
  isRead: z.boolean(),
  createdAt: z.date(),
});

export type NotificationDto = z.infer<typeof NotificationSchema>;

export const CreateNotificationSchema = z.object({
  userId: z.string(),
  type: z.string(), // Allow any string type for flexibility
  title: z.string().min(1),
  message: z.string().min(1), // Changed from description to match DB schema
  linkUrl: z.string().optional(), // Where the notification takes the user
  data: z.unknown().optional(),
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;

export const GetNotificationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
  offset: z.coerce.number().min(0).default(0),
  filter: z.enum(["all", "unread"]).default("all"),
});

export type GetNotificationsQuery = z.infer<typeof GetNotificationsQuerySchema>;
