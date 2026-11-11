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
  periods: readonly TimeSlot[] | undefined,
  /** The exact hours, when the requester gave them (client feedback 2026-11-06, A01). */
  hours?: { from?: string | null; to?: string | null }
): string | null {
  const t = useTranslations("create.when");
  const base = describeAvailability(
    days,
    periods,
    (day: IsoWeekday) => t(`weekdays.${day}`),
    (period: TimeSlot) => t(`slot.${period}`)
  );
  const exact = hours?.from && hours?.to ? t("hoursRange", { from: hours.from, to: hours.to }) : null;
  return [base, exact].filter(Boolean).join(" · ") || null;
}

export function AvailabilityLine({
  days,
  periods,
  hours,
  className = "block text-xs text-muted-foreground",
}: {
  days: readonly number[] | undefined;
  periods: readonly TimeSlot[] | undefined;
  hours?: { from?: string | null; to?: string | null };
  className?: string;
}) {
  const text = useAvailabilityText(days, periods, hours);
  if (!text) return null;
  return <span className={className}>{text}</span>;
}
