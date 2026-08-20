import type { FilterFn } from "@tanstack/react-table";

import { toLocalISO } from "@/lib/utils/date-range";

/** What `DateRangeField` reports and what `dateRangeFilterFn` reads back off the column. */
export interface DateRangeFilterValue {
  /** Local-day ISO string (YYYY-MM-DD), or "" for no lower bound. */
  from: string;
  /** Local-day ISO string (YYYY-MM-DD), or "" for no upper bound. */
  to: string;
}

/**
 * Turns a column's raw date value into a local-day ISO string for range
 * comparison. Handles the three shapes admin tables actually pass:
 * a `Date` (revived report rows), a full ISO timestamp string (most
 * `createdAt` columns), and an already-local-day string like `joinDate`
 * ("YYYY-MM-DD"). That last case can't go through `new Date(...)`: a
 * date-only ISO string parses as UTC midnight, which shifts a day backward
 * in any timezone behind UTC.
 */
function toComparableISO(raw: unknown): string | null {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : toLocalISO(raw);
  }
  if (typeof raw !== "string" || raw === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : toLocalISO(parsed);
}

/**
 * TanStack Table `filterFn` for a date column paired with `DateRangeField`.
 * A row with no readable date never matches an active range — the point of
 * the filter is "narrow to this window", not "keep the unknowns too".
 *
 * A factory rather than one shared constant: each table's `ColumnDef<TData>`
 * wants a `FilterFn<TData>`, and a single value typed for one `TData` can't
 * satisfy every table's — `TData` has to stay a real type parameter, not get
 * erased to `unknown`/`any`, for this to type-check at every call site.
 * Called once per `useMemo`'d column list, e.g. `filterFn: dateRangeFilterFn<Listing>()`.
 */
export function dateRangeFilterFn<TData>(): FilterFn<TData> {
  const filterFn: FilterFn<TData> = (row, columnId, filterValue) => {
    const { from, to } = filterValue as DateRangeFilterValue;
    const iso = toComparableISO(row.getValue(columnId));
    if (iso === null) return false;
    if (from && iso < from) return false;
    if (to && iso > to) return false;
    return true;
  };
  filterFn.autoRemove = (value: DateRangeFilterValue | undefined) =>
    !value || (!value.from && !value.to);
  return filterFn;
}
