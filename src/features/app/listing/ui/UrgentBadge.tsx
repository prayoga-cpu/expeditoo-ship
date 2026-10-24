"use client";

import { Flame } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { isUrgent, URGENT_WITHIN_HOURS, type UrgencyInput } from "@/lib/urgency";
import { cn } from "@/lib/utils";

/**
 * « Urgent », in the destructive colour, on a request with no driver whose
 * pickup is less than 48 hours away (client_feedback_2026_10_21_spec.md §B5).
 * Renders nothing otherwise, so every list can drop it in unconditionally.
 */
export function UrgentBadge({
  job,
  className,
}: {
  job: UrgencyInput;
  className?: string;
}) {
  const t = useTranslations("listingUrgency");
  if (!isUrgent(job)) return null;

  return (
    <Badge
      className={cn(
        "gap-1 border-transparent bg-destructive text-white",
        className
      )}
      title={t("hint", { hours: URGENT_WITHIN_HOURS })}
    >
      <Flame className="h-3 w-3" aria-hidden />
      {t("label")}
    </Badge>
  );
}
