"use client";

import { useId, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toDayString, weekdaysBetween } from "@/lib/availability-window";
import { cn } from "@/lib/utils";
import { FieldError } from "./FieldError";
import { MOMENT_FORMAT, PickupPublicationNotice } from "./PublicationNotice";
import type { PublicationIssues } from "../publication";
import {
  ANY_PERIOD,
  ISO_WEEKDAYS,
  TIME_SLOTS,
  TIMING_MODES,
  defaultHourForSlot,
  hourOptions,
  togglePeriods,
  type EndpointTiming,
  type IsoWeekday,
  type TimeSlot,
  type TimingMode,
  type TimingState,
} from "../timing";

interface TimingFieldProps {
  timing: TimingState;
  onChange: (next: TimingState) => void;
  pickupError?: string;
  dropoffError?: string;
  pickupDaysError?: string;
  dropoffDaysError?: string;
  /** The derived pickup start, when passed slots pushed it later. */
  pickupClampedFrom?: string | null;
  publication: PublicationIssues;
}

/**
 * "Flexible or exact?", asked once, then answered at the right granularity for
 * each answer. Exact wants an instant a person actually thinks in — a day, a
 * time of day, an hour within it. Flexible wants a range a carrier can work
 * around, the weekdays and the times of day someone is there
 * (request_availability_spec.md §5). `resolveTimingWindows` (../timing.ts)
 * turns either shape into the fields the schema validates — this component
 * never touches them directly.
 */
export function TimingField({
  timing,
  onChange,
  pickupError,
  dropoffError,
  pickupDaysError,
  dropoffDaysError,
  pickupClampedFrom,
  publication,
}: TimingFieldProps) {
  const t = useTranslations("create.when");
  const format = useFormatter();
  const today = toDayString(new Date());

  return (
    <div className="space-y-5">
      <div>
        <Label>{t("modeLabel")}</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={timing.mode}
          onValueChange={(next) =>
            next && onChange({ ...timing, mode: next as TimingMode })
          }
          className="w-full"
        >
          {TIMING_MODES.map((mode) => (
            <ToggleGroupItem key={mode} value={mode} className="flex-1">
              {t(`mode.${mode}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(`mode.${timing.mode}Hint`)}
        </p>
      </div>

      <EndpointTimingFields
        side="pickup"
        title={t("pickupTitle")}
        mode={timing.mode}
        value={timing.pickup}
        minDate={today}
        onChange={(pickup) => onChange({ ...timing, pickup })}
        error={pickupError}
        daysError={pickupDaysError}
      >
        {pickupClampedFrom && !publication.pickup && (
          <p className="text-xs text-muted-foreground">
            {t("clampedFrom", {
              from: format.dateTime(new Date(pickupClampedFrom), MOMENT_FORMAT),
            })}
          </p>
        )}
        <PickupPublicationNotice publication={publication} />
      </EndpointTimingFields>
      <EndpointTimingFields
        side="dropoff"
        title={t("dropoffTitle")}
        mode={timing.mode}
        value={timing.dropoff}
        minDate={timing.pickup.date || today}
        onChange={(dropoff) => onChange({ ...timing, dropoff })}
        error={dropoffError}
        daysError={dropoffDaysError}
      />
    </div>
  );
}

function EndpointTimingFields({
  side,
  title,
  mode,
  value,
  minDate,
  onChange,
  error,
  daysError,
  children,
}: {
  side: "pickup" | "dropoff";
  title: string;
  mode: TimingMode;
  value: EndpointTiming;
  minDate: string;
  onChange: (next: EndpointTiming) => void;
  error?: string;
  daysError?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("create.when");

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <h3 className="font-medium">{title}</h3>

      {mode === "exact" ? (
        <>
          <div>
            <Label htmlFor={`${side}-date`}>{t("dateLabel")}</Label>
            <Input
              id={`${side}-date`}
              type="date"
              min={minDate}
              value={value.date}
              onChange={(e) => onChange({ ...value, date: e.target.value })}
            />
          </div>

          <div>
            <Label>{t("slotLabel")}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={value.slot}
              onValueChange={(next) => {
                if (!next) return;
                const slot = next as TimeSlot;
                onChange({ ...value, slot, hour: defaultHourForSlot(slot) });
              }}
              className="w-full"
            >
              {TIME_SLOTS.map((slot) => (
                <ToggleGroupItem key={slot} value={slot} className="flex-1">
                  {t(`slot.${slot}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div>
            <Label htmlFor={`${side}-hour`}>{t("hourLabel")}</Label>
            <Select
              value={value.hour}
              onValueChange={(hour) => onChange({ ...value, hour })}
            >
              <SelectTrigger id={`${side}-hour`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hourOptions(value.slot).map((hour) => (
                  <SelectItem key={hour} value={hour}>
                    {hour}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${side}-from`}>{t("fromDateLabel")}</Label>
              <Input
                id={`${side}-from`}
                type="date"
                min={minDate}
                value={value.date}
                onChange={(e) =>
                  onChange({ ...value, date: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor={`${side}-until`}>{t("untilDateLabel")}</Label>
              <Input
                id={`${side}-until`}
                type="date"
                min={value.date || minDate}
                value={value.dateUntil}
                onChange={(e) =>
                  onChange({ ...value, dateUntil: e.target.value })
                }
              />
            </div>
          </div>

          <WeekdayField
            side={side}
            value={value}
            onChange={(days) => onChange({ ...value, days })}
            error={daysError}
          />

          <PeriodField
            value={value.periods}
            onChange={(periods) => onChange({ ...value, periods })}
          />
        </>
      )}

      <FieldError message={error} />
      {children}
    </section>
  );
}

/**
 * Seven boxes, Monday first, all ticked by default — the client's own words
 * were "with checkbox already checked". A day that does not occur between
 * « Du » and « Au » is disabled but keeps its tick, so widening the range
 * brings back what was chosen.
 */
function WeekdayField({
  side,
  value,
  onChange,
  error,
}: {
  side: "pickup" | "dropoff";
  value: EndpointTiming;
  onChange: (days: IsoWeekday[]) => void;
  error?: string;
}) {
  const t = useTranslations("create.when");
  const labelId = useId();
  const inRange = weekdaysBetween(value.date, value.dateUntil);
  // An incomplete or inverted range leaves nothing to grey out against.
  const choosable = (day: IsoWeekday) =>
    inRange.length === 0 || inRange.includes(day);
  const someOutside = inRange.length > 0 && inRange.length < ISO_WEEKDAYS.length;

  const toggle = (day: IsoWeekday, checked: boolean) =>
    onChange(
      ISO_WEEKDAYS.filter((d) => (d === day ? checked : value.days.includes(d)))
    );

  return (
    <div role="group" aria-labelledby={labelId}>
      <Label id={labelId}>{t("daysLabel")}</Label>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {ISO_WEEKDAYS.map((day) => {
          const id = `${side}-day-${day}`;
          const disabled = !choosable(day);
          return (
            <div
              key={day}
              className={cn("flex items-center gap-1.5", disabled && "opacity-50")}
            >
              <Checkbox
                id={id}
                checked={value.days.includes(day)}
                disabled={disabled}
                onCheckedChange={(checked) => toggle(day, checked === true)}
              />
              <Label
                htmlFor={id}
                className={cn("font-normal", !disabled && "cursor-pointer")}
              >
                {t(`weekdays.${day}`)}
              </Label>
            </div>
          );
        })}
      </div>
      {someOutside && (
        <p className="mt-1 text-xs text-muted-foreground">{t("daysOutOfRange")}</p>
      )}
      <FieldError message={error} />
    </div>
  );
}

/**
 * Four labels, one of them « N'importe quand »: at phone width a quarter of
 * the row is narrower than « N'importe », so below `sm` the four sit two by two
 * as separate pills, and join into one segmented bar from `sm` up.
 */
const PERIOD_GROUP =
  "flex-wrap gap-2 data-[variant=outline]:shadow-none sm:flex-nowrap sm:gap-0 sm:data-[variant=outline]:shadow-xs";
const PERIOD_ITEM = [
  "h-auto min-h-9 basis-[calc(50%-0.25rem)] py-1.5 whitespace-normal text-center leading-tight",
  "rounded-md data-[variant=outline]:border-l",
  "sm:basis-0 sm:rounded-none sm:first:rounded-l-md sm:last:rounded-r-md",
  "sm:data-[variant=outline]:border-l-0 sm:data-[variant=outline]:first:border-l",
].join(" ");

/**
 * Several times of day at once — "not only one", as the client put it.
 * « N'importe quand » is all three, so it shows pressed exactly when all three
 * are chosen; `togglePeriods` (../timing.ts) holds the rules.
 */
function PeriodField({
  value,
  onChange,
}: {
  value: TimeSlot[];
  onChange: (periods: TimeSlot[]) => void;
}) {
  const t = useTranslations("create.when");
  const isAny = value.length === TIME_SLOTS.length;

  return (
    <div>
      <Label>{t("slotPreferenceLabel")}</Label>
      <ToggleGroup
        type="multiple"
        variant="outline"
        value={isAny ? [ANY_PERIOD] : value}
        onValueChange={(pressed) => onChange(togglePeriods(value, pressed))}
        className={cn("w-full", PERIOD_GROUP)}
      >
        <ToggleGroupItem value={ANY_PERIOD} className={PERIOD_ITEM}>
          {t("slot.any")}
        </ToggleGroupItem>
        {TIME_SLOTS.map((slot) => (
          <ToggleGroupItem key={slot} value={slot} className={PERIOD_ITEM}>
            {t(`slot.${slot}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("slotPreferenceHint")}
      </p>
    </div>
  );
}
