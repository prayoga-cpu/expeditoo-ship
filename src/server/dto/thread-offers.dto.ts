import { z } from "zod";

import { TIME_SLOTS } from "@/lib/availability-window";
import {
  MAX_DELIVERY_LEAD_DAYS,
  isOfferSlotDay,
  resolveOfferSlots,
} from "@/lib/offer-slots";
import { MAX_OFFER_CENTS, MIN_OFFER_CENTS } from "./offers.dto";

// ========================================
// Thread Offers DTO
// ========================================
// A price put on the table inside a conversation.
// See docs/specs/thread_offer_spec.md §4.

/**
 * Send an offer in a thread.
 *
 * Exactly **one** pickup slot. `createOfferSchema` on the job page takes up to
 * twelve because an operator comparing bids benefits from choice; a chat offer
 * is a concrete proposal to one person, and the single slot is what lets the
 * recipient accept in the bubble without a picker (spec §1.2).
 *
 * The bounds are the offers engine's own, imported rather than restated, so a
 * price the chat accepts can never be one the auction refuses.
 */
export const createThreadOfferSchema = z
  .object({
    priceCents: z
      .number({ invalid_type_error: "Price must be a number" })
      .int("PRICE_NOT_INTEGER")
      .min(MIN_OFFER_CENTS, "PRICE_OUT_OF_RANGE")
      .max(MAX_OFFER_CENTS, "PRICE_OUT_OF_RANGE"),

    pickupDay: z.string().refine(isOfferSlotDay, "SLOT_DAY_INVALID"),
    pickupSlot: z.enum(TIME_SLOTS),

    /** 0 = the same day, 1 = J+1. One control, not a second calendar. */
    deliveryLeadDays: z
      .number()
      .int("DELIVERY_LEAD_OUT_OF_RANGE")
      .min(0, "DELIVERY_LEAD_OUT_OF_RANGE")
      .max(MAX_DELIVERY_LEAD_DAYS, "DELIVERY_LEAD_OUT_OF_RANGE")
      .default(0),

    /** The sender's `getTimezoneOffset()`, so "matin" means theirs. */
    tzOffset: z.number().int().min(-840).max(840).default(0),

    /** Required on the job lane, where an offer names the vehicle that will
     *  do the job. Absent on the standalone lane, which has no job to fit. */
    vehicleId: z.string().min(1).optional(),

    message: z
      .string()
      .max(1000, "Message must be 1000 characters or fewer")
      .optional(),
  })
  .superRefine((data, ctx) => {
    // The slot's **end**, not its start: a driver offering at 10:00 can still
    // do this morning, and that is the honest reading of the offer. Same rule
    // as createOfferSchema, so the two lanes cannot disagree.
    const [resolved] = resolveOfferSlots(
      [{ day: data.pickupDay, slot: data.pickupSlot }],
      data.deliveryLeadDays,
      data.tzOffset
    );
    if (resolved && resolved.endsAt <= new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SLOT_IN_PAST",
        path: ["pickupDay"],
      });
    }
  });

export type CreateThreadOfferInput = z.infer<typeof createThreadOfferSchema>;
