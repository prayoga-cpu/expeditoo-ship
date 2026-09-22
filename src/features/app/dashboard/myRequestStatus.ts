import type { Job, ListingStatus } from "@/features/app/listing/types";

/**
 * Statuses worth surfacing on the home dashboard — a request currently open
 * for bids, awarded, or being carried. `draft` is not "a request" yet,
 * and `completed`/`cancelled`/`expired` are history, already covered by
 * `/listings/me` (listing_posted_feedback_spec.md §2.4).
 */
const FEATURED_STATUSES: readonly ListingStatus[] = [
  "open",
  "awarded",
  "in_progress",
];

/**
 * The one request to lead with on the home dashboard, or null when the caller
 * has none worth featuring. Most recently created wins — a person with more
 * than one active request cares most about the one they just posted.
 */
export function featuredRequest(jobs: Job[]): Job | null {
  const candidates = jobs.filter((job) =>
    FEATURED_STATUSES.includes(job.status)
  );
  if (candidates.length === 0) return null;

  return candidates.reduce((latest, job) =>
    new Date(job.createdAt) > new Date(latest.createdAt) ? job : latest
  );
}
