"use client";

import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationPopover } from "@/features/app/notifications/ui";
import { useNotifications } from "@/features/app/notifications/hooks";
import { useUnreadMessages } from "@/features/app/messages/hooks";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "./ui/button";

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount: notificationUnreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const { unreadCount: messageUnreadCount } = useUnreadMessages();

  // Combine notification and message unread counts
  const totalUnreadCount = notificationUnreadCount + messageUnreadCount;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          suppressHydrationWarning
          className={cn(
            "relative inline-flex items-center justify-center",
            className
          )}
          aria-label="Notifications"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Bell className="w-6 h-6 cursor-pointer hover:text-primary transition-all duration-200 ease-out" />
          {totalUnreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              aria-label={`${totalUnreadCount} unread notifications`}
            >
              {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] max-w-[calc(100vw-32px)] p-0 overflow-hidden"
        align="end"
        sideOffset={8}
      >
        <NotificationPopover
          notifications={notifications}
          unreadCount={notificationUnreadCount}
          messageUnreadCount={messageUnreadCount}
          onMarkAllAsRead={markAllAsRead}
          onMarkAsRead={markAsRead}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

