/**
 * When a request is urgent (client_feedback_2026_10_21_spec.md §B5).
 *
 * Derived, not stored: there is no « urgent » box for a requester to tick, and
 * a flag nobody maintains would go on saying « urgent » after the date passed.
 * A request is urgent while it still has no driver and the moment it must be
 * collected by is less than {@link URGENT_WITHIN_HOURS} hours away.
 *
 * « Collected by » is the start of the pickup window on a fixed request, and
 * its end on a flexible one: a flexible request open from the 8th to the 31st
 * is not urgent on the 9th, it is urgent on the 30th.
 */

export const URGENT_WITHIN_HOURS = 48;

export interface UrgencyInput {
  status: string;
  pickupFrom: string | Date;
  pickupUntil: string | Date;
  isFlexible?: boolean | null;
}

/** The instant the goods must be collected by, as the rule above reads it. */
export function collectBy(job: UrgencyInput): Date {
  return new Date(job.isFlexible ? job.pickupUntil : job.pickupFrom);
}

export function isUrgent(job: UrgencyInput, now: Date = new Date()): boolean {
  if (job.status !== "open") return false;
  const left = collectBy(job).getTime() - now.getTime();
  return left > 0 && left <= URGENT_WITHIN_HOURS * 3_600_000;
}
