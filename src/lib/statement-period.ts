import { z } from "zod";

/**
 * The period a statement covers, shared by the carrier's relevé and the
 * customer's invoice bundle (billing_documents_spec.md §3.3, §4.3).
 *
 * Both bounds are optional: "all periods" is the Cocolis default and produces a
 * statement of everything.
 */
export const statementPeriodSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((p) => !p.from || !p.to || p.from <= p.to, {
    path: ["to"],
    message: "INVALID_PERIOD",
  });

export type StatementPeriod = z.infer<typeof statementPeriodSchema>;

const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Paris, not the server's zone: the bounds are a French reader's local
 * midnights sent as instants, and a UTC host printed the day before (the same
 * reason `invoice-pdf-props.ts` pins the zone on the document's own dates).
 */
const day = (date: Date) =>
  date.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

/** Human label for the PDF header. */
export function periodLabel(period: StatementPeriod, allLabel: string): string {
  const { from, to } = period;

  if (from && to) return `${day(from)} — ${day(to)}`;
  if (from) return `Depuis le ${day(from)}`;
  if (to) return `Jusqu'au ${day(to)}`;

  return allLabel;
}

/** Filename slug for the download, e.g. `releve-2026-01-01-2026-03-31.pdf`. */
export function periodSlug(period: StatementPeriod): string {
  const { from, to } = period;

  if (from && to) return `${iso(from)}-${iso(to)}`;
  if (from) return `depuis-${iso(from)}`;
  if (to) return `jusqu-${iso(to)}`;

  return "tout";
}

// ========================================
// Presets
// ========================================
// The Cocolis period dropdown, shared by the carrier's completed trips and the
// customer's invoice list so the two offer the same choices.

export const PERIOD_KEYS = [
  "all",
  "this_month",
  "last_month",
  "this_year",
] as const;

export type PeriodKey = (typeof PERIOD_KEYS)[number];

export function periodBounds(
  period: PeriodKey,
  now = new Date()
): { from?: Date; to?: Date } {
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case "this_month":
      return {
        from: new Date(year, month, 1),
        to: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };
    case "last_month":
      return {
        from: new Date(year, month - 1, 1),
        to: new Date(year, month, 0, 23, 59, 59, 999),
      };
    case "this_year":
      return {
        from: new Date(year, 0, 1),
        to: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    case "all":
      return {};
  }
}

/** Bounds as the ISO strings the REST layer takes. */
export function periodBoundsIso(period: PeriodKey, now = new Date()) {
  const { from, to } = periodBounds(period, now);
  return { from: from?.toISOString(), to: to?.toISOString() };
}
