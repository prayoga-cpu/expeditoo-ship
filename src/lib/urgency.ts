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
  /**
   * When bidding closes. An `open` row past it is a request the expiry sweep
   * has not reached yet — it reads « Expirée » (`displayStatus`), and calling
   * it urgent or immediate would invite drivers onto a job they cannot bid on.
   */
  expiresAt?: string | Date | null;
}

/** Still taking offers: open, and not past its bidding deadline. */
function stillOpen(job: UrgencyInput, now: Date): boolean {
  if (job.status !== "open") return false;
  return !job.expiresAt || new Date(job.expiresAt).getTime() >= now.getTime();
}

/** The instant the goods must be collected by, as the rule above reads it. */
export function collectBy(job: UrgencyInput): Date {
  return new Date(job.isFlexible ? job.pickupUntil : job.pickupFrom);
}

export function isUrgent(job: UrgencyInput, now: Date = new Date()): boolean {
  if (!stillOpen(job, now)) return false;
  const left = collectBy(job).getTime() - now.getTime();
  return left > 0 && left <= URGENT_WITHIN_HOURS * 3_600_000;
}

/**
 * « Immédiat » (client_feedback_2026_10_29_spec.md §B5): the goods can be
 * collected right now — the request still has no driver and its pickup window
 * has already opened. Only a flexible request can be in that state while it
 * still takes offers: a fixed one stops taking them 6 h before its window
 * opens (`biddingRunsUntil`). Independent of « Urgent »: a window open since
 * yesterday that closes tomorrow is both, and says so.
 */
export function isImmediate(
  job: UrgencyInput,
  now: Date = new Date()
): boolean {
  if (!stillOpen(job, now)) return false;
  const t = now.getTime();
  return (
    new Date(job.pickupFrom).getTime() <= t &&
    t < new Date(job.pickupUntil).getTime()
  );
}
