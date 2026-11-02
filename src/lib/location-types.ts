/**
 * The kinds of place a job collects from or delivers to — one list, read by
 * the `location_type` enum, the listing DTO and the `/create` form, so the
 * three cannot drift (CLAUDE.md gotcha 8). The order is the order the form
 * offers them in, and the enum's own: `auction_house` was added `AFTER 'shop'`
 * in `0045_request_form_feedback.sql` to keep the two equal.
 *
 * `auction_house` is a place goods are collected from — every Expedion pickup
 * is one — not a goods auction (client_feedback_2026_10_31_spec.md §8).
 */
export const LOCATION_TYPES = [
  "house",
  "apartment",
  "warehouse",
  "factory",
  "construction_site",
  "shop",
  "auction_house",
  "office",
  "storage_unit",
  "farm",
  "port",
  "airport",
  "rail_terminal",
  "other",
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

/**
 * Places where the floor changes the job. A warehouse, a site, a farm, a port
 * or a terminal is loaded at ground level (client_feedback_2026_10_31_spec.md
 * §0 H).
 */
export const FLOOR_LOCATION_TYPES = [
  "house",
  "apartment",
  "shop",
  "auction_house",
  "office",
  "storage_unit",
  "other",
] as const satisfies readonly LocationType[];

export function hasFloors(type: string | null | undefined): boolean {
  return (FLOOR_LOCATION_TYPES as readonly string[]).includes(type ?? "");
}

/**
 * Whether an end must state its floor: an apartment always, and on a move
 * every place with floors (spec §3). The lift is asked once the floor is 1 or
 * higher, and required wherever the floor is.
 */
export function floorRequired(
  type: string | null | undefined,
  isMoving: boolean
): boolean {
  return type === "apartment" || (isMoving && hasFloors(type));
}

export function liftRequired(
  type: string | null | undefined,
  isMoving: boolean,
  floor: number | null | undefined
): boolean {
  return floorRequired(type, isMoving) && floor != null && floor >= 1;
}
