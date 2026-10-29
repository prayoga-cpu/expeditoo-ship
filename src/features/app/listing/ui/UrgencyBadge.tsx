"use client";

import { Flame, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  isImmediate,
  isUrgent,
  URGENT_WITHIN_HOURS,
  type UrgencyInput,
} from "@/lib/urgency";
import { cn } from "@/lib/utils";

/**
 * The two time badges on a request with no driver
 * (client_feedback_2026_10_21_spec.md §B5, client_feedback_2026_10_29_spec.md §B5):
 *
 * - « Immédiat », amber: the pickup window is already open, so the goods can
 *   be collected right now;
 * - « Urgent », in the destructive colour: the pickup must happen within 48 h.
 *
 * Both are derived, and a request can wear both. Renders nothing when neither
 * applies, so every list can drop it in unconditionally.
 */
export function UrgencyBadge({
  job,
  className,
}: {
  job: UrgencyInput;
  className?: string;
}) {
  const t = useTranslations("listingUrgency");
  const now = new Date();
  const immediate = isImmediate(job, now);
  const urgent = isUrgent(job, now);
  if (!immediate && !urgent) return null;

  return (
    <>
      {immediate && (
        <Badge
          className={cn(
            "gap-1 border-transparent bg-amber-500 text-white dark:bg-amber-600",
            className
          )}
          title={t("immediateHint")}
        >
          <Zap className="h-3 w-3" aria-hidden />
          {t("immediate")}
        </Badge>
      )}
      {urgent && (
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
      )}
    </>
  );
}
