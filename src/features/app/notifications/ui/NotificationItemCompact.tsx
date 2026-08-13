"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Notification } from "../types";

/**
 * Compact notification item for popover display
 * Follows Single Responsibility Principle - only handles compact presentation
 * Delete functionality only available from notifications page
 */
interface NotificationItemCompactProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onClose?: () => void;
}

export function NotificationItemCompact({
  notification,
  onMarkAsRead,
  onClose,
}: NotificationItemCompactProps) {
  const router = useRouter();

  const handleClick = () => {
    // Mark as read if unread
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }

    // Navigate if link exists
    if (notification.link) {
      router.push(notification.link);
    }

    // Close popover
    if (onClose) {
      onClose();
    }
  };

  const Icon = notification.icon;

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group relative flex gap-3 p-3 rounded-lg transition-colors duration-200 cursor-pointer",
        !notification.read
          ? "bg-primary/5 hover:bg-primary/10"
          : "hover:bg-accent",
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
          !notification.read
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {Icon && <Icon className="w-5 h-5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h4
            className={cn(
              "font-semibold text-sm leading-tight truncate",
              !notification.read ? "text-foreground" : "text-foreground/90",
            )}
          >
            {notification.title}
          </h4>
          <span className="text-xs text-muted-foreground shrink-0">
            {notification.timestamp}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-tight line-clamp-2">
          {notification.description}
        </p>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
      )}
    </div>
  );
}
