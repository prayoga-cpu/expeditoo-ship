"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface NotificationItemProps {
  id: string;
  type: "message" | "bid" | "delivery" | "review" | "payment" | "listing";
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

const typeColors = {
  message: "bg-blue-100 text-blue-800",
  bid: "bg-purple-100 text-purple-800",
  delivery: "bg-green-100 text-green-800",
  review: "bg-yellow-100 text-yellow-800",
  payment: "bg-emerald-100 text-emerald-800",
  listing: "bg-pink-100 text-pink-800",
  shipment_assigned: "bg-indigo-100 text-indigo-800",
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

  const handleClick = () => {
    if (link) {
      router.push(link);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group relative flex gap-4 p-4 rounded-xl border bg-card transition-all duration-200",
        !read && "bg-primary/5 border-primary/20 shadow-sm",
        read && "border-border hover:border-border/80",
        link && "cursor-pointer hover:shadow-md hover:scale-[1.01]",
      )}
    >
      <div
        className={cn(
          "shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors",
          !read
            ? "bg-primary/10 text-primary"
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
              {t(type)}
            </Badge>
            {onDismiss && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDismiss();
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive p-1 -mr-1"
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
                className="h-7 text-xs px-3 font-medium hover:bg-primary/10 hover:text-primary"
              >
                {action.label}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {!read && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary shadow-sm" />
      )}
    </div>
  );
}
