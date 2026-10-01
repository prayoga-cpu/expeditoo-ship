/**
 * Whether `/home` offers the "become a driver" card
 * (request_summary_spec.md §1).
 *
 * The card is for someone who came to drive. A person who has posted a
 * request came to ship, and for them it read as clutter above their own
 * request. They are not cut off: opening any open job as a non-carrier shows
 * `BecomeCarrierCard`, which is the moment they want to deal.
 */
export function showsDriverInvite(input: {
  hasApplication: boolean;
  /**
   * How many requests the caller has posted, in any status. Null while that
   * is still loading, so a requester never sees the card flash.
   */
  requestCount: number | null;
}): boolean {
  if (input.hasApplication) return false;
  if (input.requestCount === null) return false;
  return input.requestCount === 0;
}
