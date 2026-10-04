"use client";

import { useTranslations } from "next-intl";
import { describeAvailability } from "@/lib/listing-availability";
import type { IsoWeekday, TimeSlot } from "@/lib/availability-window";

/**
 * The weekdays and times of day someone is there at one end of a request,
 * when the requester narrowed them (request_availability_spec.md §6).
 * Renders nothing for an unrestricted end.
 *
 * Reuses the `/create` form's own labels, the way `JobDetail` already reuses
 * `create.locationTypes`: one vocabulary for the question and its answer.
 */
export function useAvailabilityText(
  days: readonly number[] | undefined,
  periods: readonly TimeSlot[] | undefined
): string | null {
  const t = useTranslations("create.when");
  return describeAvailability(
    days,
    periods,
    (day: IsoWeekday) => t(`weekdays.${day}`),
    (period: TimeSlot) => t(`slot.${period}`)
  );
}

export function AvailabilityLine({
  days,
  periods,
  className = "block text-xs text-muted-foreground",
}: {
  days: readonly number[] | undefined;
  periods: readonly TimeSlot[] | undefined;
  className?: string;
}) {
  const text = useAvailabilityText(days, periods);
  if (!text) return null;
  return <span className={className}>{text}</span>;
}
