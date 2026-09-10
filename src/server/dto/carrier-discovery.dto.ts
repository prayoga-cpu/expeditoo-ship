import { z } from "zod";

// ========================================
// Carrier Discovery DTO
// ========================================
// What a requester may learn about a carrier whose declared trajet covers their
// job: the ten fields of docs/specs/carriers_on_route_spec.md §4.3, and an
// eleventh is a spec change rather than an implementation detail.
//
// The schema is the privacy boundary, not a formality. The service parses the
// whole match row through it — geometry, capacity, the carrier row, the user
// id — so `parse` drops everything the projection does not name. A private
// column added to the DAL read a year from now cannot reach the wire by
// somebody forgetting to strip it here.

/**
 * How much of `carriers.legal_form` may cross the wire.
 *
 * Matched to the 100 characters `carrier.dto.ts` accepts, so anything a carrier
 * legitimately typed through the product's own form arrives on the card exactly
 * as they wrote it. Spelled-out forms are why that matters and an abbreviation
 * cap does not: « société par actions simplifiée unipersonnelle » is 45
 * characters and SIRENE's own category labels are longer still, so a tighter
 * bound would clip real declarations mid-word.
 *
 * The bound is still needed, because the column is `text` and a seed, an import
 * or a future admin edit is not bound by that DTO — nobody turns a match card
 * into a billboard by writing a paragraph into the row.
 */
export const MAX_LEGAL_FORM_CHARS = 100;

export const carrierMatchSchema = z.object({
  /**
   * `carrier_routes.id`. Opaque to the client and the only handle it gets: it
   * addresses the contact endpoint, which resolves the carrier's user id
   * server-side, so no requester is ever handed one (spec §6.2).
   */
  matchId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  rating: z.number(),
  reviewCount: z.number(),
  /**
   * `carriers.legal_form`, exactly as the carrier typed it, or `null` when they
   * never did. The tenth field, added deliberately (spec §4.4).
   *
   * Safe where an address or a user id is not: a legal form is the public
   * identity of a business — printed on its own invoices, and already implied
   * by the promise that every carrier here is « un professionnel indépendant
   * validé ». It locates nobody and addresses nobody. `siret` stays off the
   * wire all the same, because it is the key that pulls the registered address
   * out of SIRENE, and for an auto-entrepreneur that address is their home.
   *
   * `null` means **not stated** and never "individual": the column is optional
   * free text, so an empty one is an absence of information, and printing
   * « Particulier » in its place would be a claim this data cannot support
   * (spec §4.5). Whitespace normalises to that same absence.
   *
   * `nullish` rather than `nullable` on purpose: a read that does not select
   * the column at all must cost a badge, not the whole list — this projection
   * is the only way a requester reaches the supply pool, and it should not be
   * possible to 500 it by narrowing a `select`.
   */
  legalForm: z
    .string()
    .nullish()
    .transform((value) => {
      const stated = value?.trim() ?? "";
      if (stated === "") return null;
      // Truncated rather than rejected: one carrier's typing must not be able
      // to refuse the parse and take every other card down with it. Marked with
      // an ellipsis when it bites, because an unmarked cut reads as a complete
      // declaration — and inventing what someone declared themselves to be is
      // the exact mistake §4.5 declines at a larger scale.
      if (stated.length <= MAX_LEGAL_FORM_CHARS) return stated;
      return `${stated.slice(0, MAX_LEGAL_FORM_CHARS - 1)}…`;
    }),
  /** Cities, never addresses or postal codes — the precedent the public
   *  confirmation payload set (transport_status_confirmation_spec.md). */
  originCity: z.string(),
  destinationCity: z.string(),
  /** Runs already clipped to the job's pickup window, soonest first. */
  nextRuns: z.array(z.string()),
  /** Kilometres off the trajet, rounded: the worse of the job's two ends. */
  detourKm: z.number(),
});

export const carrierMatchListSchema = z.object({
  items: z.array(carrierMatchSchema),
  /** Distinct carriers before the display cap — the number in the tab badge. */
  total: z.number().int().nonnegative(),
});

export type CarrierMatch = z.infer<typeof carrierMatchSchema>;
export type CarrierMatchList = z.infer<typeof carrierMatchListSchema>;
