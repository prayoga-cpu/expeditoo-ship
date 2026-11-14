/**
 * How a run's two ends are written on a card
 * (docs/specs/route_towns_and_blank_streets_spec.md).
 *
 * A shipment copies only the **street line** of each end at award, and that
 * line has been optional since 2026-11-06 — so a card that printed it alone
 * showed no town at all, or nothing, for a request posted with a town and a
 * postcode only. The town lives on the listing; these helpers put it back.
 */

/** The listing columns a card needs; every one optional, a projection may omit it. */
export interface RouteListing {
  pickupCity?: string | null;
  pickupPostalCode?: string | null;
  dropoffCity?: string | null;
  dropoffPostalCode?: string | null;
}

export interface RouteEnds {
  pickupAddress: string;
  dropoffAddress: string;
  listing?: RouteListing | null;
}

const clean = (value: string | null | undefined) => value?.trim() ?? "";

/** « 64000 Bayonne », « Bayonne », or "" when neither is known. */
export function townLine(
  postalCode: string | null | undefined,
  city: string | null | undefined
): string {
  return [clean(postalCode), clean(city)].filter(Boolean).join(" ");
}

/** « 15 quai François Ier, 64000 Bayonne » — whichever parts exist. */
export function stopLine(
  street: string | null | undefined,
  postalCode: string | null | undefined,
  city: string | null | undefined
): string {
  return [clean(street), townLine(postalCode, city)].filter(Boolean).join(", ");
}

/**
 * Both ends as towns, for a row that truncates: « Marseille » → « Bayonne ».
 * Falls back to the street where the listing carries no town, so a card never
 * reads blank.
 */
export function routeTowns(ends: RouteEnds): { from: string; to: string } {
  return {
    from: clean(ends.listing?.pickupCity) || clean(ends.pickupAddress),
    to: clean(ends.listing?.dropoffCity) || clean(ends.dropoffAddress),
  };
}

/** Both ends with their street and their town, for a card that wraps. */
export function routeStops(ends: RouteEnds): { from: string; to: string } {
  const { listing } = ends;
  return {
    from: stopLine(ends.pickupAddress, listing?.pickupPostalCode, listing?.pickupCity),
    to: stopLine(ends.dropoffAddress, listing?.dropoffPostalCode, listing?.dropoffCity),
  };
}
