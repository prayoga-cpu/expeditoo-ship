"use client";

import { NotificationItem } from "./NotificationItem";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import type { Notification, NotificationTab } from "../types";
import { useTranslations } from "next-intl";

/**
 * Pure UI component for displaying notifications
 * Follows Single Responsibility Principle - only handles presentation
 * Business logic handled by useNotifications hook in page
 *
 * @param notifications - Array of notifications to display
 * @param activeTab - Currently active tab
 * @param unreadCount - Total unread count
 * @param unreadByType - Unread counts by type
 * @param onTabChange - Callback when tab changes
 * @param onMarkAllAsRead - Callback when mark all as read is clicked
 * @param onDismiss - Callback when notification is dismissed
 */
interface NotificationsProps {
  notifications: Notification[];
  activeTab: NotificationTab;
  unreadCount: number;
  unreadByType: { all: number; message: number };
  onTabChange: (tab: NotificationTab) => void;
  onMarkAllAsRead: () => void;
  onDismiss: (id: string) => void;
  isLoading?: boolean;
}

export function Notifications({
  notifications,
  activeTab,
  unreadCount,
  unreadByType,
  onTabChange,
  onMarkAllAsRead,
  onDismiss,
  isLoading = false,
}: NotificationsProps) {
  const t = useTranslations("notifications");

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {t("title")}
            </h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {unreadCount} unread notification
                {unreadCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            className="text-sm font-medium hover:bg-primary/10 hover:text-primary"
          >
            {t("markAllRead")}
          </Button>
        )}
      </div>

      <div className="mb-6">
        <Tabs
          value={activeTab}
          onValueChange={onTabChange as (value: string) => void}
        >
          <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto gap-1 rounded-xl">
            <TabsTrigger
              value="all"
              className="px-4 py-2 rounded-lg font-medium text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              All
              {unreadByType.all > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 px-1.5 text-xs font-semibold bg-primary text-primary-foreground"
                >
                  {unreadByType.all}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="unread"
              className="px-4 py-2 rounded-lg font-medium text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              Unread
              {unreadCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 px-1.5 text-xs font-semibold bg-primary text-primary-foreground"
                >
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="message"
              className="px-4 py-2 rounded-lg font-medium text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              Messages
              {unreadByType.message > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 px-1.5 text-xs font-semibold bg-primary text-primary-foreground"
                >
                  {unreadByType.message}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-2">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              {...notification}
              onDismiss={() => onDismiss(notification.id)}
            />
          ))
        ) : (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Bell className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t("empty.title")}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t("empty.description")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
