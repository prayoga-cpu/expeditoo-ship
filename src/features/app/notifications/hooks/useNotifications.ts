import { useCallback, useMemo } from "react";
import { useTabState } from "@/features/app/common/hooks";
import {
  MessageCircle,
  TrendingUp,
  Truck,
  Star,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import type { Notification, NotificationTab, NotificationType } from "../types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead as markAllAsReadApi,
  markAsRead as markAsReadApi,
  deleteNotification as deleteNotificationApi,
} from "../api";
import type { NotificationDto } from "@/server/dto/notifications.dto";

// Type for query data cache
interface NotificationsQueryData {
  notifications: NotificationDto[];
  total: number;
}

/**
 * Custom hook for managing notifications
 * Real-time updates via Ably are handled by AblySubscriptions component
 */
export function useNotifications() {
  const { activeTab, setActiveTab } = useTabState<NotificationTab>("all");
  const queryClient = useQueryClient();

  // Fetch notifications (real-time updates via Ably)
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ["notifications", activeTab],
    queryFn: () =>
      getNotifications(
        20,
        0,
        activeTab === "unread" ? "unread" : "all"
      ),
    refetchOnWindowFocus: false,
    structuralSharing: true,
  });

  // Fetch unread count (real-time updates via Ably)
  const { data: unreadCountData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadCount,
    refetchOnWindowFocus: false,
    structuralSharing: true,
  });

  // Note: Real-time updates are handled by AblySubscriptions component
  // which invalidates these queries when notification:new events arrive

  // Map API data to UI format
  const notifications: Notification[] = useMemo(() => {
    if (!notificationsData?.notifications) return [];

    return notificationsData.notifications
      .filter((n) => {
        // Client-side filtering for "message" tab since API doesn't support type filter yet
        if (activeTab === "message") return n.type === "message";
        return true;
      })
      .map((n) => {
        // Extract resourceId from data if available
        const data = n.data as { resourceId?: string; resourceType?: string; linkUrl?: string } | undefined;
        const resourceId = data?.resourceId;

        return {
          id: n.id,
          type: n.type as NotificationType,
          title: n.title,
          description: n.message, // Use message instead of description
          timestamp: getRelativeTime(n.createdAt), // Helper function
          read: n.isRead,
          icon: getIcon(n.type),
          // Use explicit linkUrl if available (legacy support), otherwise construct from resourceId
          link: data?.linkUrl || getLink(n.type, resourceId),
          action: resourceId ? getAction(n.type, resourceId) : undefined,
        };
      });
  }, [notificationsData, activeTab]);

  // Mutations
  const markAsReadMutation = useMutation({
    mutationFn: markAsReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAsRead = useCallback(
    (id: string) => {
      markAsReadMutation.mutate(id);
    },
    [markAsReadMutation]
  );

  const markAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: deleteNotificationApi,
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["notifications", activeTab] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<NotificationsQueryData>(["notifications", activeTab]);

      // Optimistically update to the new value
      queryClient.setQueryData<NotificationsQueryData>(
        ["notifications", activeTab],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            notifications: old.notifications.filter((n) => n.id !== id),
            // We can optionally decrement total, though exact count syncing happens on invalidate
            total: Math.max(0, (old.total || 0) - 1),
          };
        }
      );


      return { previousData };
    },
    onError: (err, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["notifications", activeTab],
          context.previousData
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const deleteNotification = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  const unreadCount = unreadCountData ?? 0;

  const unreadByType = useMemo(
    () => ({
      all: unreadCount,
      message: 0, // TODO: Implement count by type API
    }),
    [unreadCount]
  );

  return {
    notifications,
    activeTab,
    setActiveTab,
    unreadCount,
    unreadByType,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    isLoading,
  };
}

// Helpers
function getIcon(type: string) {
  switch (type) {
    case "bid":
      return TrendingUp;
    case "listing":
      return AlertCircle;
    case "message":
      return MessageCircle;
    case "delivery":
    case "shipment_assigned":
      return Truck;
    case "review":
      return Star;
    case "payment":
      return CreditCard;
    default:
      return AlertCircle;
  }
}

function getLink(type: string, resourceId?: string | null) {
  if (!resourceId) return "/notifications";
  switch (type) {
    case "bid":
    case "listing":
      return `/auction/${resourceId}`;
    case "message":
      return `/messages/${resourceId}`;
    case "delivery":
    case "shipment_assigned":
      return `/deliveries/${resourceId}`;
    case "review":
      return `/profile/reviews`;
    case "payment":
      return "/notifications"; // Wallet removed from project
    default:
      return "/notifications";
  }
}

function getAction(type: string, resourceId: string) {
  switch (type) {
    case "message":
      return { label: "Reply", href: `/messages/${resourceId}` };
    default:
      return undefined;
  }
}

function getRelativeTime(dateString: string | Date) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}
