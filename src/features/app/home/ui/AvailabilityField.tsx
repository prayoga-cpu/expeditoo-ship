"use client";

import { CalendarDays } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  MAX_AVAILABILITY_DAYS,
  TIME_SLOTS,
  parseDayString,
  startOfToday,
  toDayString,
  type TimeSlot,
} from "@/lib/availability-window";

interface AvailabilityFieldProps {
  /** `YYYY-MM-DD`, the days the driver can drive. */
  days: string[];
  slots: TimeSlot[];
  onChange: (patch: { days?: string[]; slots?: TimeSlot[] }) => void;
  className?: string;
}

/**
 * Which days the driver is free, and at what time of day.
 *
 * A job open "between 26 August and 9 September" tells a driver almost nothing
 * about when it happens, and a driver free only on the 2nd had no way to say
 * so. Days are picked individually rather than as a range, because
 * availability is not contiguous — a driver free on two Saturdays is not free
 * for the fortnight between them.
 *
 * Slots apply to every selected day (board_route_search_spec.md §8), and mean
 * nothing without one, so the row is disabled until a day is chosen.
 */
export function AvailabilityField({
  days,
  slots,
  onChange,
  className,
}: AvailabilityFieldProps) {
  const t = useTranslations("jobBoard.availability");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  const selected = days.map(parseDayString).sort((a, b) => a.getTime() - b.getTime());

  const handleSelect = (next: Date[] | undefined) => {
    const chosen = (next ?? [])
      .map(toDayString)
      .sort()
      .slice(0, MAX_AVAILABILITY_DAYS);

    // Dropping the last day drops the slots with it: a time of day on no date
    // is not a constraint, and leaving it set would resurface silently.
    onChange({ days: chosen, slots: chosen.length === 0 ? [] : slots });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start font-normal",
            days.length === 0 && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="h-4 w-4" />
          {summarise()}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-3">
        <Calendar
          mode="multiple"
          selected={selected}
          onSelect={handleSelect}
          // Opens where the selection is, not on today's month — a deep link
          // from a declared trip often points weeks out.
          defaultMonth={selected[0]}
          numberOfMonths={1}
          disabled={{ before: startOfToday() }}
          locale={dateLocale}
          className="p-0"
          classNames={{
            // `--color-accent` is aliased to `--primary` in globals.css, so the
            // shared calendar paints today in the same blue it paints a chosen
            // day. Readable when one day is picked at a time; not here, where
            // the whole control is which days are chosen. Scoped to this
            // instance rather than fixed in `calendar.tsx`, which every admin
            // date filter also renders.
            today:
              "rounded-md ring-1 ring-primary/40 ring-inset text-foreground",
          }}
        />

        <div className="mt-3 space-y-2 border-t pt-3">
          <Label className="text-muted-foreground text-sm">
            {t("slotsLabel")}
          </Label>
          <ToggleGroup
            type="multiple"
            variant="outline"
            value={slots}
            onValueChange={(next) => onChange({ slots: next as TimeSlot[] })}
            disabled={days.length === 0}
            className="w-full"
          >
            {TIME_SLOTS.map((slot) => (
              <ToggleGroupItem key={slot} value={slot} className="flex-1">
                {t(`slot.${slot}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-muted-foreground text-sm">
            {days.length === 0 ? t("slotsHintEmpty") : t("slotsHint")}
          </p>
        </div>

        {days.length > 0 && (
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => onChange({ days: [], slots: [] })}
          >
            {t("clear")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );

  function summarise() {
    if (selected.length === 0) return t("empty");
    if (selected.length === 1) {
      return format(selected[0], "d MMM", { locale: dateLocale });
    }
    return t("count", { count: selected.length });
  }
}
