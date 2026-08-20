/**
 * Local-calendar-day date helpers for admin table date-range filters.
 * Deliberately not `.toISOString()`, which reads the UTC date and is off by
 * one for any timezone ahead of UTC during the first hours of the local day.
 */

export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inverse of `toLocalISO` — parses as a local calendar day, not UTC midnight. */
export function parseLocalISO(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayLocalISO(): string {
  return toLocalISO(new Date());
}

export function addDaysLocalISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toLocalISO(new Date(y, m - 1, d + days));
}

export function startOfMonthLocalISO(): string {
  const now = new Date();
  return toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
}

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7Days"
  | "last30Days"
  | "thisMonth";

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  "today",
  "yesterday",
  "last7Days",
  "last30Days",
  "thisMonth",
];

export type DateRangeLabelKey = DateRangePreset | "custom";

/**
 * Classifies a `from`/`to` (YYYY-MM-DD) pair against the well-known presets a
 * date-range field offers, so the trigger button can read "Last 7 days"
 * instead of two raw dates. Falls back to "custom" for anything else,
 * including a manually-picked range that happens to match no preset.
 */
export function describeDateRange(from: string, to: string): DateRangeLabelKey {
  const today = todayLocalISO();

  if (from === today && to === today) return "today";

  const yesterday = addDaysLocalISO(today, -1);
  if (from === yesterday && to === yesterday) return "yesterday";

  if (to === today && from === addDaysLocalISO(today, -6)) return "last7Days";
  if (to === today && from === addDaysLocalISO(today, -29)) return "last30Days";
  if (to === today && from === startOfMonthLocalISO()) return "thisMonth";

  return "custom";
}

/** The inverse of `describeDateRange` — the concrete from/to for a given preset. */
export function resolveDateRangePreset(preset: DateRangePreset): {
  from: string;
  to: string;
} {
  const today = todayLocalISO();

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const yesterday = addDaysLocalISO(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case "last7Days":
      return { from: addDaysLocalISO(today, -6), to: today };
    case "last30Days":
      return { from: addDaysLocalISO(today, -29), to: today };
    case "thisMonth":
      return { from: startOfMonthLocalISO(), to: today };
  }
}
