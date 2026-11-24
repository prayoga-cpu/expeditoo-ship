import { z } from "zod";
import { JOB_KINDS } from "@/lib/moving";

// ========================================
// Recent requests DTO
// ========================================
// What the public landing page may show of the newest open requests
// (docs/specs/landing_2026_11_spec.md §4). Anyone reads it, signed in or not,
// and a CDN keeps a copy for a minute — so it is the `public` audience of
// `listing-view.ts`, narrowed further to what a card needs.
//
// The schema is the boundary, not a formality: the service parses the public
// view through it, and `z.object` drops every key it does not name. No street,
// no postal code, no pin (not even the rounded one), no contact, no note, no
// requester, no budget, no photo. A fifteenth field is a spec change.

/** How many cards the landing shows, and the most the endpoint ever returns. */
export const RECENT_REQUESTS_LIMIT = 6;

/** A timestamp as the wire carries it, whichever side of `JSON` it is on. */
const instant = z
  .union([z.date(), z.string()])
  .transform((value) => new Date(value).toISOString());

export const recentRequestSchema = z.object({
  /** Addresses `/listing/[id]`, whose own route projects for its viewer. */
  id: z.string(),
  /** The number the requester and staff quote (`formatListingReference`). */
  reference: z.number().int(),
  title: z.string(),
  jobKind: z.enum(JOB_KINDS),
  /** Towns and countries only — the precedent `carrier-discovery.dto.ts` set. */
  pickupCity: z.string(),
  pickupCountry: z.string(),
  dropoffCity: z.string(),
  dropoffCountry: z.string(),
  pickupFrom: instant,
  pickupUntil: instant,
  isFlexible: z.boolean(),
  /** An item's weight; a move's is derived from its size and not shown. */
  weightKg: z.number(),
  movingSurfaceM2: z.number().nullable(),
  movingVolumeM3: z.number().nullable(),
});

export const recentRequestListSchema = z.object({
  items: z.array(recentRequestSchema).max(RECENT_REQUESTS_LIMIT),
});

/** The fields a card may carry, in the order the schema names them. */
export const RECENT_REQUEST_FIELDS = Object.keys(
  recentRequestSchema.shape
) as (keyof z.infer<typeof recentRequestSchema>)[];

export type RecentRequest = z.output<typeof recentRequestSchema>;
export type RecentRequestList = z.output<typeof recentRequestListSchema>;
