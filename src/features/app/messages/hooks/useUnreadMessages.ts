import { useQuery } from "@tanstack/react-query";
import { messagesApi } from "../api";

/**
 * Custom hook to fetch unread message count only.
 * Lightweight for global usage (Sidebar, Navbar, NotificationBell).
 * Real-time updates via Ably are handled by AblySubscriptions component
 * which invalidates this query when badge:update events arrive.
 */
export function useUnreadMessages() {
  const { data: unreadCount = 0, isLoading } = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: () => messagesApi.getUnreadCount(),
    refetchOnWindowFocus: false,
    structuralSharing: true,
  });

  return { unreadCount, isLoading };
}

