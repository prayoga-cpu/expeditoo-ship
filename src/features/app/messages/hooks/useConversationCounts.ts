import { useQuery } from "@tanstack/react-query";
import { messagesApi } from "../api";

/**
 * The number beside each Messages filter chip.
 *
 * Its key sits under `["messages", "conversations"]` on purpose: everything
 * that already refreshes the inbox — a new message over Ably, a deleted
 * conversation, an offer — refreshes the counts with it, with no second list
 * of invalidations to keep in step.
 */
export const conversationCountsKey = ["messages", "conversations", "counts"] as const;

export function useConversationCounts() {
  return useQuery({
    queryKey: conversationCountsKey,
    queryFn: () => messagesApi.getConversationCounts(),
    refetchOnWindowFocus: false,
    structuralSharing: true,
  });
}
