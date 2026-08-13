"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Bell, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationItemCompact } from "./NotificationItemCompact";
import type { Notification } from "../types";

/**
 * Notification Popover Content Component
 * Displays recent notifications in a compact floating box
 * Follows Single Responsibility Principle - only handles popover presentation
 *
 * @param notifications - All notifications
 * @param unreadCount - Total unread count for notifications
 * @param messageUnreadCount - Unread messages count
 * @param onMarkAllAsRead - Callback to mark all as read
 * @param onMarkAsRead - Callback to mark single notification as read
 * @param onClose - Callback to close popover
 */
interface NotificationPopoverProps {
  notifications: Notification[];
  unreadCount: number;
  messageUnreadCount?: number;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onClose: () => void;
}

export function NotificationPopover({
  notifications,
  unreadCount,
  messageUnreadCount = 0,
  onMarkAllAsRead,
  onMarkAsRead,
  onClose,
}: NotificationPopoverProps) {
  // Get 5 most recent notifications
  const recentNotifications = useMemo(() => {
    return notifications.slice(0, 5);
  }, [notifications]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-background">
        <h3 className="text-base font-semibold text-foreground">
          Notifications
        </h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            className="h-auto py-1 px-2 text-xs font-medium hover:bg-primary/10 hover:text-primary"
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* Unread Messages Banner */}
      {messageUnreadCount > 0 && (
        <Link href="/messages" onClick={onClose}>
          <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border-b hover:bg-primary/10 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {messageUnreadCount} unread message{messageUnreadCount > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">Tap to view</p>
            </div>
          </div>
        </Link>
      )}

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto overflow-x-clip">
        {recentNotifications.length > 0 ? (
          <div className="p-2 space-y-1">
            {recentNotifications.map((notification) => (
              <NotificationItemCompact
                key={notification.id}
                notification={notification}
                onMarkAsRead={onMarkAsRead}
                onClose={onClose}
              />
            ))}
          </div>
        ) : messageUnreadCount === 0 ? (
          // Empty State - only show if no messages either
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Bell className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <h4 className="text-base font-semibold text-foreground mb-1">
              No notifications yet
            </h4>
            <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">
              We'll notify you when something important happens.
            </p>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      {(recentNotifications.length > 0 || messageUnreadCount > 0) && (
        <div className="sticky bottom-0 z-10 p-3 border-t bg-background">
          <Link href="/notifications" onClick={onClose}>
            <Button
              variant="ghost"
              className="w-full text-sm font-medium hover:bg-primary/10 hover:text-primary"
            >
              View All
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

