import { useMemo, useState, useCallback, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { messagesApi, type ConversationResponse } from "../api";
import type { ListingChip, Message } from "../types";
import { listingsApi } from "@/features/app/listing/api/listings.api";
import { myRequestKeys } from "@/features/app/listing/hooks/useMyRequests";
import { activeRequests } from "@/features/app/dashboard/myRequestStatus";
import type { Job } from "@/features/app/listing/types";
import { jobDates, routeOf } from "../lib/job-summary";
import { initialsOf } from "../lib/initials";
import { useConversationFilter } from "./useConversationFilter";

/**
 * The jobs the search offers as filters (§D5): every job the viewer has a
 * thread about, then their own live requests — so a requester with no
 * conversation yet still sees their requests, and a way to find carriers.
 */
export function listingChips(
  conversations: ConversationResponse[],
  ownRequests: Job[]
): ListingChip[] {
  const own = new Set(ownRequests.map((job) => job.id));
  const chips = new Map<string, ListingChip>();
  for (const conv of conversations) {
    const route = routeOf(conv.listing?.pickupCity, conv.listing?.dropoffCity);
    if (!conv.listing || !route || chips.has(conv.listing.id)) continue;
    chips.set(conv.listing.id, {
      id: conv.listing.id,
      route,
      title: conv.listing.title,
      own: own.has(conv.listing.id),
    });
  }
  for (const job of ownRequests) {
    if (chips.has(job.id)) continue;
    chips.set(job.id, {
      id: job.id,
      route: `${job.pickupCity} → ${job.dropoffCity}`,
      title: job.title,
      own: true,
    });
  }
  return [...chips.values()];
}

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
  // A job picked from the chips under the search box (§D5).
  const [listingFilter, setListingFilter] = useState<string | null>(null);
  // The state of the job, held in the URL so Back restores it (#26).
  const { filter: stateFilter, setFilter: setStateFilter } = useConversationFilter();
  const queryClient = useQueryClient();
  const t = useTranslations("messages");
  const locale = useLocale();

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

  const listKey = useMemo(
    () => ["messages", "conversations", debouncedSearch, stateFilter] as const,
    [debouncedSearch, stateFilter]
  );

  // Fetch conversations from API (real-time updates via Ably)
  const {
    data: conversations = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: listKey,
    queryFn: () =>
      messagesApi.getConversations(1, 50, debouncedSearch || undefined, stateFilter),
    refetchOnWindowFocus: false,
    structuralSharing: true,
    // Switching chip keeps the rows on screen until the new ones arrive,
    // instead of swapping the whole page for the loader.
    placeholderData: keepPreviousData,
  });

  // The unfiltered inbox, for the chips: same key as the main read when the
  // box is empty, so it costs no second request then.
  const { data: everyConversation = [] } = useQuery({
    queryKey: ["messages", "conversations", "", "all"],
    queryFn: () => messagesApi.getConversations(1, 50, undefined, "all"),
    refetchOnWindowFocus: false,
    structuralSharing: true,
  });
  const { data: mine = [] } = useQuery({
    queryKey: myRequestKeys.list(),
    queryFn: () => listingsApi.mine(),
  });
  const chips = useMemo(
    () => listingChips(everyConversation, activeRequests(mine)),
    [everyConversation, mine]
  );

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
      await queryClient.cancelQueries({ queryKey: listKey });

      // Snapshot the previous value
      const previousConversations = queryClient.getQueryData<ConversationResponse[]>(
        listKey
      );

      // Optimistically update to the new value
      queryClient.setQueryData<ConversationResponse[]>(
        listKey,
        (old) => (old ? old.filter((c) => c.id !== conversationId) : [])
      );

      // Return a context with the previous value
      return { previousConversations };
    },
    // Said out loud: the row vanishing optimistically was the only sign it
    // had worked (client feedback 2026-10-21, §D4).
    onSuccess: () => toast.success(t("deleted")),
    onError: (err, newTodo, context) => {
      // Use the context returned from onMutate to roll back
      if (context?.previousConversations) {
        queryClient.setQueryData(
          listKey,
          context.previousConversations
        );
      }
      toast.error(t("deleteFailed"));
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
        initials: conv.otherParticipant
          ? initialsOf(conv.otherParticipant)
          : undefined,
        avatar: conv.otherParticipant?.image || undefined,
        listing: conv.listing?.title || t("item.noListing"),
        snippet: conv.lastMessage || "",
        timestamp: conv.lastMessageAt ? formatTimestamp(conv.lastMessageAt) : "",
        unread: conv.isUnread,
        type: conv.type,
        listingId: conv.listing?.id,
        route:
          routeOf(conv.listing?.pickupCity, conv.listing?.dropoffCity) ??
          undefined,
        dates:
          jobDates(conv.listing?.pickupFrom, conv.listing?.dropoffUntil, locale) ??
          undefined,
      }))
      .filter((message) => !listingFilter || message.listingId === listingFilter),
    [conversations, t, formatTimestamp, listingFilter, locale]
  );



  return {
    messages: allMessages,
    searchQuery,
    setSearchQuery: handleSearchChange,
    listingChips: chips,
    listingFilter,
    setListingFilter,
    stateFilter,
    setStateFilter,
    unreadCount,
    deleteConversation,
    isLoading,
    error,
    refetch,
  };
}


