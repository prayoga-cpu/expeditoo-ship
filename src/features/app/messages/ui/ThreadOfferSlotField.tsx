"use client";

import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  TIME_SLOTS,
  parseDayString,
  startOfToday,
  toDayString,
  type TimeSlot,
} from "@/lib/availability-window";

/** What the form offers. The schema allows a week; nobody needs it. */
const DELIVERY_LEADS = [0, 1, 2, 3];

interface ThreadOfferSlotFieldProps {
  day: string | null;
  onDayChange: (day: string) => void;
  slot: TimeSlot;
  onSlotChange: (slot: TimeSlot) => void;
  deliveryLeadDays: number;
  onDeliveryLeadChange: (days: number) => void;
  /** The job's pickup window on the job lane. Absent on a standalone thread,
   *  which has no job to constrain the calendar. */
  window?: { from: Date; until: Date; isFlexible: boolean };
}

/**
 * "When can you do it?", answered once.
 *
 * Deliberately **not** `OfferSlotsField`. That component proposes up to four
 * days so an operator comparing bids has choice, and it requires a job window.
 * A chat offer is a concrete proposal to one person: exactly one day and one
 * time of day, which is what lets the recipient accept in the bubble with no
 * slot picker and no wrong slot to book (thread_offer_spec.md §1.2). It reuses
 * the same lib helpers and the same `listing.bid.slots.slot.*` wording, so the
 * two surfaces speak one vocabulary.
 */
export function ThreadOfferSlotField({
  day,
  onDayChange,
  slot,
  onSlotChange,
  deliveryLeadDays,
  onDeliveryLeadChange,
  window,
}: ThreadOfferSlotFieldProps) {
  const t = useTranslations("listing.bid.slots");
  const tOffer = useTranslations("messages.offer");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  const today = startOfToday();
  // Days outside the job's window cannot be proposed, so PICKUP_OUTSIDE_WINDOW
  // is pre-empted in the form rather than hit on the server.
  const disabled = (date: Date) => {
    if (date < today) return true;
    if (!window || window.isFlexible) return false;
    return date < startOfDay(window.from) || date > endOfDay(window.until);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{tOffer("pickupLabel")}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
              {day
                ? format(parseDayString(day), "EEEE d MMMM", {
                    locale: dateLocale,
                  })
                : tOffer("pickupPlaceholder")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={day ? parseDayString(day) : undefined}
              onSelect={(next) => next && onDayChange(toDayString(next))}
              disabled={disabled}
              locale={dateLocale}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label>{tOffer("periodLabel")}</Label>
        <ToggleGroup
          type="single"
          value={slot}
          onValueChange={(next) => next && onSlotChange(next as TimeSlot)}
          className="w-full"
          variant="outline"
        >
          {TIME_SLOTS.map((period) => (
            <ToggleGroupItem
              key={period}
              value={period}
              className="flex-1"
              aria-label={t(`slot.${period}`)}
            >
              {t(`slot.${period}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <Label>{t("deliveryLabel")}</Label>
        <ToggleGroup
          type="single"
          value={String(deliveryLeadDays)}
          onValueChange={(next) => next && onDeliveryLeadChange(Number(next))}
          className="w-full"
          variant="outline"
        >
          {DELIVERY_LEADS.map((lead) => (
            <ToggleGroupItem key={lead} value={String(lead)} className="flex-1">
              {lead === 0 ? t("leadSameDay") : t("leadDays", { count: lead })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">{t("deliveryHint")}</p>
      </div>
    </div>
  );
}

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};
