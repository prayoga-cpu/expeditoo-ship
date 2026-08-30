"use client";

import { useMemo } from "react";
import { CalendarPlus, X } from "lucide-react";
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
import {
  MAX_OFFER_SLOT_DAYS,
  offerablePeriods,
  slotsForDays,
  type OfferSlotInput,
  type PickupWindow,
} from "@/lib/offer-slots";

/** What the form offers. The schema allows up to a week; nobody needs it. */
const DELIVERY_LEADS = [0, 1, 2, 3];

interface OfferSlotsFieldProps {
  slots: OfferSlotInput[];
  onSlotsChange: (slots: OfferSlotInput[]) => void;
  deliveryLeadDays: number;
  onDeliveryLeadChange: (days: number) => void;
  /** The job's pickup window. Days outside it cannot be proposed. */
  window: PickupWindow;
  /** Injected by the tests; production reads the wall clock. */
  now?: Date;
}

/** A day the carrier proposed, with the times of day they could do it. */
interface DayRow {
  day: string;
  periods: TimeSlot[];
}

/**
 * "When can you do it?", answered more than once.
 *
 * A driver free on the 25th *or* the 27th used to have to pick one and hope.
 * The unit is a day plus a time of day, not a clock time — a driver knows they
 * can be there in the morning, not that they can be there at 09:14, and it is
 * the vocabulary the board search already speaks.
 *
 * A newly added day arrives with all three periods selected. That is the
 * permissive reading — "le 25/08 en journée", literally the reference the
 * client gave — and it means the control has no invalid state to report:
 * clearing the last period on a day removes the day instead.
 */
export function OfferSlotsField({
  slots,
  onSlotsChange,
  deliveryLeadDays,
  onDeliveryLeadChange,
  window,
  now = new Date(),
}: OfferSlotsFieldProps) {
  const t = useTranslations("listing.bid.slots");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  const rows = useMemo(() => groupByDay(slots), [slots]);
  const selected = rows.map((row) => parseDayString(row.day));
  const atDayCap = rows.length >= MAX_OFFER_SLOT_DAYS;
  const chosenDays = new Set(rows.map((row) => row.day));

  // The same question the service asks, asked at the same granularity: the
  // calendar can only gate whole days, but `SLOT_IN_PAST` and
  // `PICKUP_OUTSIDE_WINDOW` are decided per slot — and an offer is refused
  // entire, so one unofferable period would cost the driver the whole bid.
  const tzOffset = now.getTimezoneOffset();
  const offerable = (day: string) =>
    offerablePeriods(day, window, now, tzOffset);

  const handleSelect = (next: Date[] | undefined) =>
    onSlotsChange(
      slotsForDays(
        slots,
        // No slice: the calendar closes every unchosen day at the cap, so a
        // fifth is unreachable. Trimming here instead would silently delete a
        // day the driver had already picked.
        (next ?? []).map(toDayString).sort(),
        offerable
      )
    );

  // An empty period list drops the day with it — see `slotsForDays`.
  const setPeriods = (day: string, periods: TimeSlot[]) =>
    onSlotsChange(
      rows
        .map((row) => (row.day === day ? { day, periods } : row))
        .flatMap(({ day: on, periods: chosen }) =>
          chosen.map((slot) => ({ day: on, slot }))
        )
    );

  // A day with no offerable period is a day that cannot be proposed at all —
  // which covers "before today", "after the client's window", and "today, but
  // every period of it has already ended". At the cap only the days already
  // chosen stay live, so one can be swapped for another without the control
  // silently dropping a choice.
  const dayClosed = (date: Date) => {
    const day = toDayString(date);
    if (atDayCap && !chosenDays.has(day)) return true;
    return offerable(day).length === 0;
  };

  const earliest = window.isFlexible
    ? startOfToday()
    : new Date(Math.max(startOfToday().getTime(), window.from.getTime()));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{t("label")}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
            >
              <CalendarPlus className="h-4 w-4" />
              {t("addDay")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-3">
            <Calendar
              mode="multiple"
              selected={selected}
              onSelect={handleSelect}
              defaultMonth={selected[0] ?? earliest}
              numberOfMonths={1}
              disabled={dayClosed}
              locale={dateLocale}
              className="p-0"
              classNames={{
                today:
                  "rounded-md ring-1 ring-primary/40 ring-inset text-foreground",
              }}
            />
            <p className="text-muted-foreground mt-3 border-t pt-3 text-sm">
              {t("dayLimit", { count: MAX_OFFER_SLOT_DAYS })}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <>
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.day}
              className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-medium">
                {format(parseDayString(row.day), "EEE d MMM", {
                  locale: dateLocale,
                })}
              </span>

              <div className="flex items-center gap-1">
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  size="sm"
                  value={row.periods}
                  onValueChange={(next) =>
                    setPeriods(row.day, next as TimeSlot[])
                  }
                >
                  {TIME_SLOTS.map((slot) => (
                    <ToggleGroupItem
                      key={slot}
                      value={slot}
                      // Shown rather than hidden, for the reason the vehicle
                      // select shows a van too small: a control that vanishes
                      // reads as a broken form.
                      disabled={!offerable(row.day).includes(slot)}
                    >
                      {t(`slot.${slot}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeDay")}
                  onClick={() => setPeriods(row.day, [])}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {/* The cap's own explanation lives in the popover the trigger opens,
            and at the cap that trigger is disabled — so it has to be said out
            here too, or the driver meets a dead button and no reason. */}
        {atDayCap && (
          <p className="text-muted-foreground mt-2 text-sm">
            {t("dayLimitReached", { count: MAX_OFFER_SLOT_DAYS })}
          </p>
        )}
        </>
      )}

      <div className="space-y-2">
        <Label>{t("deliveryLabel")}</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={String(deliveryLeadDays)}
          onValueChange={(next) => next && onDeliveryLeadChange(Number(next))}
          className="w-full"
        >
          {DELIVERY_LEADS.map((lead) => (
            <ToggleGroupItem key={lead} value={String(lead)} className="flex-1">
              {lead === 0 ? t("leadSameDay") : t("leadDays", { count: lead })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-muted-foreground text-sm">{t("deliveryHint")}</p>
      </div>
    </div>
  );
}

/** The flat wire shape as one row per day, days and periods both in order. */
function groupByDay(slots: readonly OfferSlotInput[]): DayRow[] {
  const byDay = new Map<string, TimeSlot[]>();
  for (const { day, slot } of slots) {
    byDay.set(day, [...(byDay.get(day) ?? []), slot]);
  }

  return [...byDay.entries()]
    .map(([day, periods]) => ({
      day,
      periods: TIME_SLOTS.filter((slot) => periods.includes(slot)),
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
