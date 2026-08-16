/**
 * Ordering for the driver's active shipments.
 *
 * Pure and separate from the hook so it can be tested directly — this exact
 * ordering was wrong once already: the dashboard took the first item straight
 * from the API, which `shipmentsDal.getForUser` sorts by `desc(createdAt)`.
 * That answers "most recently awarded", not "what am I doing right now", so a
 * driver halfway through a delivery who then won another job saw the brand new
 * PENDING job announced as their current run.
 */

/** How far along a shipment is. Lower means more underway. */
const PROGRESS_RANK: Record<string, number> = {
  IN_TRANSIT: 0,
  PICKED_UP: 1,
  ASSIGNED: 2,
  PENDING: 3,
};

/** Unknown statuses sort after every known one rather than ahead of them. */
const UNKNOWN_RANK = Number.MAX_SAFE_INTEGER;

export interface OrderableRun {
  status: string;
  scheduledPickup: string | null;
}

/**
 * Most-underway first, then most imminent pickup. Returns a new array; the
 * input is React Query's cached data and must not be sorted in place.
 */
export function orderRunsByProgress<T extends OrderableRun>(runs: T[]): T[] {
  return [...runs].sort((a, b) => {
    const rank =
      (PROGRESS_RANK[a.status] ?? UNKNOWN_RANK) -
      (PROGRESS_RANK[b.status] ?? UNKNOWN_RANK);
    if (rank !== 0) return rank;

    // Unscheduled runs sort last rather than to the epoch.
    const aAt = a.scheduledPickup ? Date.parse(a.scheduledPickup) : Infinity;
    const bAt = b.scheduledPickup ? Date.parse(b.scheduledPickup) : Infinity;
    return aAt - bAt;
  });
}
