import {
  BIDDING_LEAD_MS,
  MIN_BIDDING_WINDOW_MS,
  expiresAtFor,
  publicationProblem,
} from "@/lib/listing-window";
import { firstUsablePickup } from "./timing";

/**
 * Whether the request on screen can be published as it stands, said before the
 * round trip and on the step where the date was chosen
 * (docs/specs/publication_timing_spec.md §3).
 *
 * The rule is the server's own (`publicationProblem`, `expiresAtFor` in
 * `src/lib/listing-window.ts`), measured from now. These are **publication**
 * checks: shown on the When and Budget steps, they block « Publier » and
 * nothing else — not « Suivant », and never a draft, which is not going
 * anywhere.
 */

export type PickupIssue =
  | { kind: "inPast" }
  | { kind: "tooSoon"; earliest: Date };

export type ScheduleIssue =
  | { kind: "required" }
  | { kind: "past" }
  | { kind: "tooClose"; latest: Date }
  /** No moment the picker offers would still work: only publishing now does. */
  | { kind: "unschedulable" };

export interface PublicationIssues {
  pickup: PickupIssue | null;
  schedule: ScheduleIssue | null;
  /**
   * The warning tier: when bidding would close less than six hours after
   * publication, the moment it closes. Only ever set when nothing above is
   * wrong.
   */
  biddingClosesAt: Date | null;
}

interface PublicationValues {
  pickupFrom?: unknown;
  pickupUntil?: unknown;
  publishMode?: unknown;
  scheduledPublishAt?: unknown;
}

/**
 * How late the publishing cron may reach a scheduled request. It runs every
 * five minutes (`.github/workflows/scheduled-jobs.yml`), GitHub starts
 * scheduled runs late, and `publishScheduled` re-checks the bidding window
 * against the moment it actually runs — so a schedule right on the limit the
 * server accepts at creation is expired when the cron gets there. The form
 * keeps this much short of it.
 */
export const SCHEDULE_SLACK_MS = 15 * 60 * 1000;

/**
 * The earliest a schedule is offered at all: enough that the value survives the
 * round trip to the server without landing in the past under ordinary clock
 * skew. The schedule picker's own minimum, and the bound below which a
 * "latest" is advice nobody could follow.
 */
export const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;

const NONE: PublicationIssues = {
  pickup: null,
  schedule: null,
  biddingClosesAt: null,
};

/** A form value as a Date — the fields hold `datetime-local` strings until submit. */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The server says `PICKUP_IN_PAST` as soon as a window has started. To the
 * requester a window still under way — this morning until noon, at eleven —
 * is not "passed", it is too close: only a window that has ended is.
 */
function pickupIssue(
  pickupFrom: Date,
  pickupUntil: Date | null,
  now: Date
): PickupIssue | null {
  const problem = publicationProblem(pickupFrom, now, now);
  if (!problem) return null;
  const ended = problem === "PICKUP_IN_PAST" && (!pickupUntil || pickupUntil <= now);
  return ended ? { kind: "inPast" } : { kind: "tooSoon", earliest: firstUsablePickup(now) };
}

/**
 * A schedule is judged only once publishing now would be fine: when even now
 * is too late, the pickup is what has to move, and saying so twice would send
 * the requester to two places for one problem.
 */
function scheduleIssue(
  pickupFrom: Date,
  scheduledAt: Date | null,
  now: Date,
  pickupIsFine: boolean
): ScheduleIssue | null {
  if (!scheduledAt) return { kind: "required" };
  if (scheduledAt <= now) return { kind: "past" };
  const reached = new Date(scheduledAt.getTime() + SCHEDULE_SLACK_MS);
  if (pickupIsFine && !expiresAtFor(pickupFrom, reached)) {
    const latest = new Date(
      pickupFrom.getTime() - MIN_BIDDING_WINDOW_MS - SCHEDULE_SLACK_MS
    );
    // A pickup under about fifty minutes away leaves no schedule the picker
    // offers that would still work; naming a moment already gone would be
    // advice nobody could follow.
    return latest.getTime() <= now.getTime() + MIN_SCHEDULE_LEAD_MS
      ? { kind: "unschedulable" }
      : { kind: "tooClose", latest };
  }
  return null;
}

export function publicationIssues(
  values: PublicationValues,
  now = new Date()
): PublicationIssues {
  const pickupFrom = toDate(values.pickupFrom);
  // A missing or malformed date is the schema's to report.
  if (!pickupFrom) return NONE;

  const scheduling = values.publishMode === "schedule";
  const scheduledAt = toDate(values.scheduledPublishAt);
  const pickup = pickupIssue(pickupFrom, toDate(values.pickupUntil), now);
  const schedule = scheduling
    ? scheduleIssue(pickupFrom, scheduledAt, now, pickup === null)
    : null;
  if (pickup || schedule) return { pickup, schedule, biddingClosesAt: null };

  const publishAt = scheduling && scheduledAt ? scheduledAt : now;
  const closesAt = expiresAtFor(pickupFrom, publishAt);
  const short =
    closesAt !== null &&
    closesAt.getTime() - publishAt.getTime() < BIDDING_LEAD_MS;
  return { pickup: null, schedule: null, biddingClosesAt: short ? closesAt : null };
}
