import {
  ISO_WEEKDAYS,
  TIME_SLOTS,
  type IsoWeekday,
  type TimeSlot,
} from "./availability-window";

/** A run this long reads better as its two ends: « Lun–Ven », not five names. */
const MIN_RUN = 3;

/** Consecutive weekdays, Monday first. Sunday does not run on into Monday. */
function runsOf(days: readonly IsoWeekday[]): IsoWeekday[][] {
  const runs: IsoWeekday[][] = [];
  for (const day of days) {
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1] === day - 1) run.push(day);
    else runs.push([day]);
  }
  return runs;
}

/**
 * One end of a request's weekdays and times of day in words —
 * « Lun–Ven · Matin, Soir » — or `null` when nothing is restricted, which is
 * the full set, an empty one, or none stored at all
 * (request_availability_spec.md §6). The labels are passed in, so this stays
 * free of any translation library.
 */
export function describeAvailability(
  days: readonly number[] | undefined,
  periods: readonly TimeSlot[] | undefined,
  dayLabel: (day: IsoWeekday) => string,
  periodLabel: (period: TimeSlot) => string
): string | null {
  const chosenDays = ISO_WEEKDAYS.filter((day) => days?.includes(day));
  const chosenPeriods = TIME_SLOTS.filter((period) => periods?.includes(period));

  const dayText =
    chosenDays.length > 0 && chosenDays.length < ISO_WEEKDAYS.length
      ? runsOf(chosenDays)
          .flatMap((run) =>
            run.length >= MIN_RUN
              ? [`${dayLabel(run[0])}–${dayLabel(run[run.length - 1])}`]
              : run.map(dayLabel)
          )
          .join(", ")
      : null;
  const periodText =
    chosenPeriods.length > 0 && chosenPeriods.length < TIME_SLOTS.length
      ? chosenPeriods.map(periodLabel).join(", ")
      : null;

  const parts = [dayText, periodText].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
