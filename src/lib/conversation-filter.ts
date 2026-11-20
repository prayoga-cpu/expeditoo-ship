import type { ListingStatus } from "@/db/schema/listings";

/**
 * The Messages filter by the state of the job a conversation is about
 * (client feedback 2026-11-19, #26: « possible to select messages among types
 * below? », over a photo of another product's « Mes annonces » filter).
 *
 * The status → bucket mapping lives here and nowhere else: the list filter,
 * the counts and the chips all read it. The type import is erased, so the
 * browser bundle gets the names and not the schema; `conversation-filter.test.ts`
 * holds the mapping against `listingStatusEnum` itself, so a ninth status
 * fails there (and in `tsc`, through the `Record`) instead of silently falling
 * out of every chip but « Toutes ».
 */

/** Where a conversation sits, by its job. `none`: it is about no job. */
export const CONVERSATION_BUCKETS = ["waiting", "active", "done", "none"] as const;
export type ConversationBucket = (typeof CONVERSATION_BUCKETS)[number];

/** What `?filter=` may say. `all` is the absence of a filter. */
export const CONVERSATION_FILTERS = ["all", ...CONVERSATION_BUCKETS] as const;
export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number];

export const DEFAULT_CONVERSATION_FILTER: ConversationFilter = "all";

/**
 * - `waiting` — no transporter chosen yet: the request is taking offers, or
 *   will once its owner publishes it (a draft has a thread only after it was
 *   taken back to be changed; a scheduled one goes live on its date).
 * - `active` — a transporter is chosen and the run is not finished.
 * - `done` — nothing more will happen: delivered, cancelled or expired.
 */
export const LISTING_STATUS_BUCKET: Record<
  ListingStatus,
  Exclude<ConversationBucket, "none">
> = {
  draft: "waiting",
  scheduled: "waiting",
  open: "waiting",
  awarded: "active",
  in_progress: "active",
  completed: "done",
  cancelled: "done",
  expired: "done",
};

/** The bucket of a conversation, from its job's status — or `none` without a job. */
export function conversationBucket(
  status: ListingStatus | null | undefined
): ConversationBucket {
  return status ? LISTING_STATUS_BUCKET[status] : "none";
}

export function isConversationFilter(value: unknown): value is ConversationFilter {
  return (
    typeof value === "string" &&
    (CONVERSATION_FILTERS as readonly string[]).includes(value)
  );
}

export type ConversationCounts = Record<ConversationFilter, number>;

export const emptyConversationCounts = (): ConversationCounts => ({
  all: 0,
  waiting: 0,
  active: 0,
  done: 0,
  none: 0,
});

/**
 * Folds the grouped read — one row per job status, `null` for no job — into
 * what the chips show. `all` is the sum, so the five numbers always agree.
 */
export function toConversationCounts(
  rows: { status: ListingStatus | null; count: number }[]
): ConversationCounts {
  const counts = emptyConversationCounts();
  for (const row of rows) {
    const n = Number(row.count) || 0;
    counts[conversationBucket(row.status)] += n;
    counts.all += n;
  }
  return counts;
}
