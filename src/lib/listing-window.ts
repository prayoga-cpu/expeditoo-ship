/**
 * ============================================================================
 * When a job is biddable, and how a re-boarded one becomes biddable again
 * ============================================================================
 *
 * Two rules that have to agree and previously lived in two places: the bidding
 * lead `listingsService.resolveExpiresAt` applies when a job is posted, and the
 * window a job needs when it comes back to the board after a transporter
 * withdrew. They are the same arithmetic, and a re-board computed against a
 * different lead would put a job on the board that closes to bids before anyone
 * can see it.
 *
 * Pure and throw-free on purpose: `listings.service.ts` wraps `expiresAtFor`
 * to raise `PICKUP_TOO_SOON`, and `offers.service.ts` cannot import that
 * service — it is imported *by* it.
 *
 * See docs/specs/cancellations_spec.md §4.3.
 */

/** Bidding closes 6 h before pickup, unless the job is posted later than that. */
export const BIDDING_LEAD_MS = 6 * 60 * 60 * 1000;

/** Below this there is no time to bid at all. */
export const MIN_BIDDING_WINDOW_MS = 30 * 60 * 1000;

/**
 * How far forward a re-boarded job's pickup window slides when the original has
 * run out. A day: long enough that a replacement transporter can plan around
 * it, short enough that a client who wanted the goods moved this week still
 * gets them moved this week.
 */
export const REBOARD_LEAD_MS = 24 * 60 * 60 * 1000;

/**
 * The moment bidding should close for a job collecting at `pickupFrom`, or
 * `null` when there is no usable window left.
 */
export function expiresAtFor(pickupFrom: Date, now = new Date()): Date | null {
  const preferred = new Date(pickupFrom.getTime() - BIDDING_LEAD_MS);
  if (preferred > now) return preferred;

  const clamped = new Date(now.getTime() + MIN_BIDDING_WINDOW_MS);
  return clamped > pickupFrom ? null : clamped;
}

export interface ListingWindow {
  pickupFrom: Date;
  pickupUntil: Date;
  dropoffFrom: Date;
  dropoffUntil: Date;
}

/**
 * Only the bidding deadline, for a job whose own dates must **not** be touched.
 *
 * `compensateFailedAward` re-opens a listing seconds after a card was declined.
 * Nobody withdrew, nothing was announced, and no marker is stamped — so sliding
 * the client's pickup and dropoff dates there would move a real-world plan on
 * the strength of a payment failure, and leave a machine-moved window with
 * nothing saying so. `null` means the job cannot be usefully re-opened at all,
 * and the caller should leave its dates as they are.
 */
export function rearmedExpiry(
  pickupFrom: Date,
  now = new Date()
): Date | null {
  const expiresAt = expiresAtFor(pickupFrom, now);
  if (!expiresAt) return null;

  return expiresAt.getTime() - now.getTime() >= MIN_BIDDING_WINDOW_MS
    ? expiresAt
    : null;
}

/**
 * The window fields a job needs to be live on the board again.
 *
 * If the original pickup window still leaves **usable** room to bid, only
 * `expiresAt` moves — the client's dates are theirs and are not rewritten for
 * convenience. If it does not, the whole window slides forward by
 * `REBOARD_LEAD_MS` with every duration preserved, because a job whose
 * collection date has passed cannot be re-sold at any price.
 */
export function rearmedWindow(
  listing: ListingWindow,
  now = new Date()
): ListingWindow & { expiresAt: Date } {
  // A *usable* window, not merely a future one. `expiresAtFor` happily returns
  // an expiry five minutes out — at posting time that is the poster's own
  // choice, but here it means the 15-minute sweep expires the job and every bid
  // just restored before anybody could bid on either. That is the exact outcome
  // this function exists to prevent, and it is the commonest withdrawal there
  // is: a driver dropping a job the morning it collects.
  const asIs = rearmedExpiry(listing.pickupFrom, now);
  if (asIs) {
    return { ...toWindow(listing), expiresAt: asIs };
  }

  const shift = now.getTime() + REBOARD_LEAD_MS - listing.pickupFrom.getTime();
  const slid = shiftWindow(listing, shift);

  // The shifted pickup is a day out, so this branch cannot come back null —
  // but reading a non-null assertion off arithmetic is how a job ends up on the
  // board with an expiry in the past.
  const expiresAt =
    expiresAtFor(slid.pickupFrom, now) ??
    new Date(now.getTime() + MIN_BIDDING_WINDOW_MS);

  return { ...slid, expiresAt };
}

function toWindow(listing: ListingWindow): ListingWindow {
  return {
    pickupFrom: listing.pickupFrom,
    pickupUntil: listing.pickupUntil,
    dropoffFrom: listing.dropoffFrom,
    dropoffUntil: listing.dropoffUntil,
  };
}

function shiftWindow(listing: ListingWindow, ms: number): ListingWindow {
  const move = (d: Date) => new Date(d.getTime() + ms);
  return {
    pickupFrom: move(listing.pickupFrom),
    pickupUntil: move(listing.pickupUntil),
    dropoffFrom: move(listing.dropoffFrom),
    dropoffUntil: move(listing.dropoffUntil),
  };
}
