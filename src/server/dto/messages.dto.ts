import { z } from "zod";

export const createConversationSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
  listingId: z.string().optional(),
  initialMessage: z.string().min(1, "Message content is required").optional(),
});

export const sendMessageSchema = z
  .object({
    recipientId: z.string().optional(), // Optional if conversationId is provided
    conversationId: z.string().optional(), // Optional if recipientId is provided
    listingId: z.string().optional(),
    content: z.string().min(1, "Message content is required").max(2000),
  })
  .refine((data) => data.recipientId || data.conversationId, {
    message: "Either recipientId or conversationId is required",
  });

export const getMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const getConversationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(), // Search by participant name or listing title
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>;
export type GetConversationsQuery = z.infer<typeof getConversationsQuerySchema>;
