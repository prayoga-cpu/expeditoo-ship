/**
 * How precisely someone who is not vetted may know where a job is: two
 * decimals of latitude or longitude, about a kilometre
 * (listing_privacy_spec.md §1).
 *
 * Two places apply it, and they must agree to the bit. `listing-view.ts`
 * rounds the coordinates a card shows; `listings.dal.ts` rounds the ones the
 * board's location filters read. A filter run on the exact pin answers "is it
 * within r km of here?" more precisely than the card, and about 120 such
 * questions put the pin back to the metre, whatever the card says.
 *
 * So the SQL is a transcription of `roundCoordinate`: the same IEEE double
 * arithmetic, `floor(value × 100 + 0.5) / 100`. Postgres's own
 * `round(numeric, 2)` would not do — it rounds a half away from zero, on the
 * decimal, and so disagrees with JavaScript on negative longitudes.
 */
export const COORDINATE_SCALE = 100;

/** A coordinate as the public reads it. Change the SQL in `listings.dal.ts` with it. */
export function roundCoordinate(value: number): number {
  return Math.floor(value * COORDINATE_SCALE + 0.5) / COORDINATE_SCALE;
}
