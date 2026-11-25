"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { NotificationType } from "../types";

interface NotificationItemProps {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  // Accept either a rendered node or a component reference (e.g. lucide icon)
  icon: React.ElementType | React.ReactNode;
  link?: string;
  action?: {
    label: string;
    href: string;
  };
  onDismiss?: () => void;
}

const typeColors: Record<NotificationType, string> = {
  message: "tone-info",
  offer_received: "tone-info",
  offer_accepted: "tone-success",
  offer_rejected: "tone-neutral",
  offer_declined: "tone-neutral",
  offer_invalidated: "tone-warning",
  listing_expired: "tone-warning",
  listing_posted: "tone-success",
  listing: "tone-info",
  delivery: "tone-success",
  shipment_update: "tone-success",
  shipment_assigned: "tone-info",
  shipment_cancelled: "tone-danger",
  // The job is not off — it is back on the board — so this is not a red one.
  shipment_withdrawn: "tone-warning",
  job_reopened: "tone-info",
  carrier_application: "tone-warning",
  review: "tone-warning",
  payment: "tone-success",
};

export function NotificationItem({
  id: _id,
  type,
  title,
  description,
  timestamp,
  read,
  icon,
  link,
  action,
  onDismiss,
}: NotificationItemProps) {
  const router = useRouter();
  const t = useTranslations("notifications.types");
  const tItem = useTranslations("notifications");

  const handleClick = () => {
    if (link) {
      router.push(link);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group relative flex gap-4 rounded-lg border border-border bg-card p-4 transition-colors",
                link && "cursor-pointer hover:bg-muted/40",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md",
          !read
            ? "bg-muted text-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {React.isValidElement(icon)
          ? // Already a rendered React element
          icon
          : // icon may be a component (function or forwardRef object) or a primitive
          (() => {
            const Icon = icon as React.ElementType | undefined;
            if (!Icon) return null;
            return <Icon className="w-5 h-5" />;
          })()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3
              className={cn(
                "font-semibold text-sm leading-tight",
                !read ? "text-foreground" : "text-foreground/90",
              )}
            >
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs font-medium px-2 py-0.5",
                typeColors[type],
              )}
            >
              {/* The server sends more types than this list names; an
                  unknown one reads « Notification », never a raw key. */}
              {t.has(type) ? t(type) : t("other")}
            </Badge>
            {onDismiss && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDismiss();
                }}
                aria-label={tItem("dismiss")}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:text-destructive p-1 -mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <p
          className={cn(
            "text-sm leading-relaxed mb-2 line-clamp-2",
            read ? "text-muted-foreground" : "text-foreground/80",
          )}
        >
          {description}
        </p>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground font-medium">
            {timestamp}
          </span>
          {action && (
            <Link href={action.href} onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-xs font-medium"
              >
                {action.label}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {!read && (
        <div className="absolute top-4 right-4 size-2 rounded-full bg-primary" />
      )}
    </div>
  );
}
