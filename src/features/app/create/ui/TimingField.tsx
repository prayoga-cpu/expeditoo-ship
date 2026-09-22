"use client";

import { useTranslations } from "next-intl";
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
import { toDayString } from "@/lib/availability-window";
import { FieldError } from "./FieldError";
import {
  TIME_SLOTS,
  TIMING_MODES,
  defaultHourForSlot,
  hourOptions,
  type EndpointTiming,
  type TimingMode,
  type TimingState,
} from "../timing";

interface TimingFieldProps {
  timing: TimingState;
  onChange: (next: TimingState) => void;
  pickupError?: string;
  dropoffError?: string;
}

/**
 * "Flexible or exact?", asked once, then answered at the right granularity for
 * each answer. Exact wants an instant a person actually thinks in — a day, a
 * time of day, an hour within it. Flexible wants a range a carrier can work
 * around, with the same time-of-day as an optional narrowing rather than a
 * requirement. `resolveTimingWindows` (../timing.ts) turns either shape into
 * the `pickupFrom`/`pickupUntil`/`dropoffFrom`/`dropoffUntil`/`isFlexible`
 * fields the schema has always validated — this component never touches them
 * directly.
 */
export function TimingField({
  timing,
  onChange,
  pickupError,
  dropoffError,
}: TimingFieldProps) {
  const t = useTranslations("create.when");
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
      />
      <EndpointTimingFields
        side="dropoff"
        title={t("dropoffTitle")}
        mode={timing.mode}
        value={timing.dropoff}
        minDate={timing.pickup.date || today}
        onChange={(dropoff) => onChange({ ...timing, dropoff })}
        error={dropoffError}
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
}: {
  side: "pickup" | "dropoff";
  title: string;
  mode: TimingMode;
  value: EndpointTiming;
  minDate: string;
  onChange: (next: EndpointTiming) => void;
  error?: string;
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
                const slot = next as (typeof TIME_SLOTS)[number];
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

          <div>
            <Label>{t("slotPreferenceLabel")}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={value.hasSlotPreference ? value.slot : "any"}
              onValueChange={(next) => {
                if (!next) return;
                if (next === "any") onChange({ ...value, hasSlotPreference: false });
                else
                  onChange({
                    ...value,
                    hasSlotPreference: true,
                    slot: next as (typeof TIME_SLOTS)[number],
                  });
              }}
              className="w-full"
            >
              <ToggleGroupItem value="any" className="flex-1">
                {t("slot.any")}
              </ToggleGroupItem>
              {TIME_SLOTS.map((slot) => (
                <ToggleGroupItem key={slot} value={slot} className="flex-1">
                  {t(`slot.${slot}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("slotPreferenceHint")}
            </p>
          </div>
        </>
      )}

      <FieldError message={error} />
    </section>
  );
}
