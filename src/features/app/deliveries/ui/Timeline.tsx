import type React from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface TimelineEvent {
  label: string;
  date: string;
  status: "completed" | "active" | "pending";
  icon?: React.ReactNode;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {
  const t = useTranslations();

  return (
    <div className="space-y-0">
      {events.map((event, index) => (
        <div key={index} className="flex gap-4 pb-6 relative">
          {/* Line connector */}
          {index < events.length - 1 && (
            <div
              className={cn(
                "absolute left-6 top-12 bottom-0 w-1 rounded-full",
                event.status === "completed" ? "bg-primary" : "bg-muted"
              )}
            />
          )}

          {/* Circle icon */}
          <div className="relative shrink-0">
            <div
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center ring-4",
                event.status === "completed"
                  ? "bg-primary text-primary-foreground ring-primary/20"
                  : event.status === "active"
                    ? "bg-accent-pink text-white ring-accent-pink/20"
                    : "bg-muted text-muted-foreground ring-muted"
              )}
            >
              {event.icon}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 pt-1">
            <h4 className="font-bold text-foreground">
              {event.label.includes(".") ? t(event.label) : event.label}
            </h4>
            <p className="text-sm text-muted-foreground">{event.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
