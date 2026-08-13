import { useMemo, useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { messagesApi, type ConversationResponse } from "../api";
import type { Message } from "../types";

/**
 * Custom hook for managing messages list
 * Follows Single Responsibility Principle - handles messages data and filtering
 * Uses TanStack Query for data fetching and caching
 * Real-time updates via Ably are handled by AblySubscriptions component
 * Search is performed server-side for efficiency
 */
export function useMessages() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const queryClient = useQueryClient();
  const t = useTranslations("messages");

  // Mark all messages as seen when page loads
  // This clears the unread badge from the notification bell
  // Non-critical operation - fails silently if user has no conversations
  useEffect(() => {
    const markAsSeen = async () => {
      try {
        await messagesApi.markAllAsSeen();
        // Invalidate unread count to refresh the badge
        queryClient.invalidateQueries({ queryKey: ["messages", "unread-count"] });
      } catch {
        // Silently ignore - this is a non-critical background operation
        // that can fail if user has no conversations yet
      }
    };
    markAsSeen();
  }, [queryClient]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  // Fetch conversations from API (real-time updates via Ably)
  const {
    data: conversations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["messages", "conversations", debouncedSearch],
    queryFn: () => messagesApi.getConversations(1, 50, debouncedSearch || undefined),
    refetchOnWindowFocus: false,
    structuralSharing: true,
  });

  // Fetch unread count (real-time updates via Ably)
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: () => messagesApi.getUnreadCount(),
    structuralSharing: true,
  });

  // Note: Real-time updates are handled by AblySubscriptions component
  // which invalidates these queries when badge:update events arrive

  // Delete conversation mutation
  const deleteMutation = useMutation({
    mutationFn: (conversationId: string) => messagesApi.deleteConversation(conversationId),
    onMutate: async (conversationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["messages", "conversations", debouncedSearch]
      });

      // Snapshot the previous value
      const previousConversations = queryClient.getQueryData<ConversationResponse[]>(
        ["messages", "conversations", debouncedSearch]
      );

      // Optimistically update to the new value
      queryClient.setQueryData<ConversationResponse[]>(
        ["messages", "conversations", debouncedSearch],
        (old) => (old ? old.filter((c) => c.id !== conversationId) : [])
      );

      // Return a context with the previous value
      return { previousConversations };
    },
    onError: (err, newTodo, context) => {
      // Use the context returned from onMutate to roll back
      if (context?.previousConversations) {
        queryClient.setQueryData(
          ["messages", "conversations", debouncedSearch],
          context.previousConversations
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success:
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", "unread-count"] });
    },
  });

  const deleteConversation = useCallback(
    (conversationId: string) => {
      deleteMutation.mutate(conversationId);
    },
    [deleteMutation]
  );

  // Helper function to format timestamp
  const formatTimestamp = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return t("time.today");
    } else if (diffDays === 1) {
      return t("time.yesterday");
    } else if (diffDays < 7) {
      return t("time.daysAgo", { count: diffDays });
    } else {
      return date.toLocaleDateString();
    }
  }, [t]);

  // Transform API response to UI format
  const allMessages: Message[] = useMemo(
    () =>
      conversations.map((conv: ConversationResponse) => ({
        id: conv.id,
        name: conv.otherParticipant?.name || t("detail.unknown"),
        avatar: conv.otherParticipant?.image || undefined,
        listing: conv.listing?.title || t("item.noListing"),
        snippet: conv.lastMessage || "",
        timestamp: conv.lastMessageAt ? formatTimestamp(conv.lastMessageAt) : "",
        unread: conv.isUnread,
      })),
    [conversations, t, formatTimestamp]
  );



  return {
    messages: allMessages,
    searchQuery,
    setSearchQuery: handleSearchChange,
    unreadCount,
    deleteConversation,
    isLoading,
    error,
  };
}


