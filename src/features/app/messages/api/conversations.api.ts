import { api } from "@/lib/fetcher";

/**
 * Opens (or reuses) the direct conversation with another user and returns its
 * id, so the caller can navigate straight to the thread.
 */
export async function startConversation(
  recipientId: string,
  listingId?: string
): Promise<{ conversationId: string; isNew: boolean }> {
  return await api.post<{ conversationId: string; isNew: boolean }>(
    "/api/messages/init",
    { recipientId, listingId }
  );
}
