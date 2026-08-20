"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DATE_RANGE_PRESETS,
  describeDateRange,
  parseLocalISO,
  resolveDateRangePreset,
  toLocalISO,
  type DateRangePreset,
} from "@/lib/utils/date-range";

interface DateRangeFieldProps {
  id?: string;
  /** Local-day ISO string (YYYY-MM-DD), or "" for no lower bound. */
  from: string;
  /** Local-day ISO string (YYYY-MM-DD), or "" for no upper bound. */
  to: string;
  onChange: (from: string, to: string) => void;
  /** Quick-pick shortcuts shown above the calendar. Pass `[]` to hide them. */
  presets?: readonly DateRangePreset[];
  className?: string;
  align?: "start" | "center" | "end";
}

/**
 * A single trigger button showing the current range (or matching preset
 * label) that opens a popover with quick presets and a two-month
 * range-highlighted calendar — the standard shape for admin table date
 * filters, so every table wires the same interaction instead of a bespoke
 * From/To pair.
 */
export function DateRangeField({
  id,
  from,
  to,
  onChange,
  presets = DATE_RANGE_PRESETS,
  className,
  align = "start",
}: DateRangeFieldProps) {
  const t = useTranslations("common.datePicker");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(undefined);

  React.useEffect(() => {
    if (!open) return;
    setDraft(
      from
        ? { from: parseLocalISO(from), to: to ? parseLocalISO(to) : undefined }
        : undefined
    );
  }, [open, from, to]);

  const activePreset = from && to ? describeDateRange(from, to) : "custom";

  const label = React.useMemo(() => {
    if (activePreset !== "custom") return t(`presets.${activePreset}`);
    if (!from) return t("pickDateRange");
    const opts = { locale: dateLocale };
    const fromDate = parseLocalISO(from);
    if (!to || to === from) return format(fromDate, "d MMM yyyy", opts);
    return `${format(fromDate, "d MMM yyyy", opts)} - ${format(parseLocalISO(to), "d MMM yyyy", opts)}`;
  }, [activePreset, from, to, t, dateLocale]);

  const applyPreset = (preset: DateRangePreset) => {
    const range = resolveDateRangePreset(preset);
    onChange(range.from, range.to);
    setOpen(false);
  };

  const handleSelect = (range: DateRange | undefined) => {
    setDraft(range);
    if (range?.from && range?.to) {
      onChange(toLocalISO(range.from), toLocalISO(range.to));
    }
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange("", "");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-9 w-full justify-start text-left font-normal sm:w-auto",
            !from && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        {presets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b p-3">
            {presets.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={activePreset === preset ? "default" : "outline"}
                className="h-8 shrink-0 rounded-full px-3 text-xs"
                onClick={() => applyPreset(preset)}
              >
                {t(`presets.${preset}`)}
              </Button>
            ))}
            {from ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground h-8 shrink-0 px-3 text-xs"
                onClick={handleClear}
              >
                {t("clear")}
              </Button>
            ) : null}
          </div>
        )}
        <Calendar
          initialFocus
          mode="range"
          locale={dateLocale}
          defaultMonth={draft?.from ?? (from ? parseLocalISO(from) : undefined)}
          selected={draft}
          onSelect={handleSelect}
          numberOfMonths={2}
          className="mx-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
