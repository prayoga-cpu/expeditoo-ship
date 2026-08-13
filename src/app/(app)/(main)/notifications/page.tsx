"use client";

import { Notifications } from "@/features/app/notifications/ui";
import { useNotifications } from "@/features/app/notifications/hooks";

/**
 * Notifications page - Orchestration layer
 * Follows SOLID principle - uses hooks for business logic, passes data to UI components
 */
export default function NotificationsPage() {
  const {
    notifications,
    activeTab,
    setActiveTab,
    unreadCount,
    unreadByType,
    markAllAsRead,
    deleteNotification,
    isLoading,
  } = useNotifications();

  return (
    <Notifications
      notifications={notifications}
      activeTab={activeTab}
      unreadCount={unreadCount}
      unreadByType={unreadByType}
      isLoading={isLoading}
      onTabChange={setActiveTab}
      onMarkAllAsRead={markAllAsRead}
      onDismiss={deleteNotification}
    />
  );
}
