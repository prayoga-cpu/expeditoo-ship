"use client";

import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck, Truck } from "lucide-react";

import { addDays } from "@/lib/offer-slots";
import { parseDayString } from "@/lib/availability-window";
import { useAvailabilityText } from "./AvailabilityLine";
import type { Job, Offer } from "../types";

/**
 * What the requester is about to book, read before any card
 * (client_feedback_2026_10_29_spec.md §N1): when the carrier collects, by
 * when they deliver, and the delivery days and times the requester gave on
 * `/create` — so a promise that does not fit them is seen before paying, not
 * after. Labels are the offer card's own (`listing.bid.offerCard`).
 */
export function BookingSummary({
  job,
  offer,
  slotId,
}: {
  job: Job;
  offer: Offer;
  slotId?: string;
}) {
  const t = useTranslations("listing.bid.offerCard");
  const tb = useTranslations("booking");
  const dateLocale = useLocale() === "fr" ? fr : enUS;
  const availability = useAvailabilityText(job.dropoffDays, job.dropoffPeriods);

  const slot = offer.slots.find((s) => s.id === slotId) ?? offer.slots[0];
  const dayLabel = (day: string) =>
    format(parseDayString(day), "EEE d MMM", { locale: dateLocale });

  const pickup = slot
    ? t("slotLine", { day: dayLabel(slot.day), period: t(`slot.${slot.slot}`) })
    : format(new Date(offer.estimatedPickup), "d MMM, HH:mm", { locale: dateLocale });
  const delivery = slot
    ? t("deliveryBy", { day: dayLabel(addDays(slot.day, offer.deliveryLeadDays)) })
    : format(new Date(offer.estimatedDelivery), "d MMM, HH:mm", { locale: dateLocale });

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
      <p className="flex items-start gap-2">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          {tb("pickup")} <span className="font-medium">{pickup}</span>
        </span>
      </p>
      <p className="flex items-start gap-2">
        <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          {tb("delivery")} <span className="font-medium">{delivery}</span>
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        {availability
          ? tb("yourAvailability", { availability })
          : tb("noAvailability")}
      </p>
    </div>
  );
}
