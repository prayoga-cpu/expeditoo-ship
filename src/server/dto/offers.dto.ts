import { z } from "zod";

import { TIME_SLOTS } from "@/lib/availability-window";
import {
  MAX_DELIVERY_LEAD_DAYS,
  MAX_OFFER_SLOTS,
  MAX_OFFER_SLOT_DAYS,
  hasDuplicateSlots,
  isOfferSlotDay,
  resolveOfferSlots,
  slotDayCount,
} from "@/lib/offer-slots";

// ========================================
// Offers DTO
// ========================================
// Contract for the reverse-bidding engine.
// See docs/specs/offers_engine_spec.md §3.

/** 1 EUR. Below this an offer is a data-entry mistake, not a bid. */
export const MIN_OFFER_CENTS = 100;
/** 100 000 EUR. Above this, the job belongs in a negotiated contract. */
export const MAX_OFFER_CENTS = 10_000_000;

export const OFFER_SORT_VALUES = [
  "price_asc",
  "price_desc",
  "rating_desc",
  "pickup_asc",
  "created_desc",
] as const;

const priceCentsSchema = z
  .number({ invalid_type_error: "Price must be a number" })
  .int("PRICE_NOT_INTEGER")
  .min(MIN_OFFER_CENTS, "PRICE_OUT_OF_RANGE")
  .max(MAX_OFFER_CENTS, "PRICE_OUT_OF_RANGE");

/** One proposed slot: a day and a time of day, in the driver's own words. */
export const offerSlotInputSchema = z.object({
  day: z.string().refine(isOfferSlotDay, "SLOT_DAY_INVALID"),
  slot: z.enum(TIME_SLOTS),
});

/**
 * Submit an offer.
 *
 * Cross-field rules that need only the input itself are refined here. Rules
 * needing the listing or the vehicle (pickup window, vehicle capacity) belong
 * to the service, which has those rows.
 *
 * `estimatedPickup` / `estimatedDelivery` are **not** input any more: they are
 * derived from the earliest slot (offer_time_slots_spec.md §3.3), which is
 * what makes a delivery-before-pickup offer unrepresentable rather than
 * merely refused.
 */
export const createOfferSchema = z
  .object({
    vehicleId: z.string().min(1, "Vehicle is required"),
    priceCents: priceCentsSchema,
    slots: z
      .array(offerSlotInputSchema)
      .min(1, "SLOTS_REQUIRED")
      .max(MAX_OFFER_SLOTS, "TOO_MANY_SLOTS"),
    /** 0 = the same day, 1 = J+1. One control, not a second calendar. */
    deliveryLeadDays: z
      .number()
      .int("DELIVERY_LEAD_OUT_OF_RANGE")
      .min(0, "DELIVERY_LEAD_OUT_OF_RANGE")
      .max(MAX_DELIVERY_LEAD_DAYS, "DELIVERY_LEAD_OUT_OF_RANGE")
      .default(0),
    /** The client's `getTimezoneOffset()`, so "matin" means the driver's. */
    tzOffset: z.number().int().min(-840).max(840).default(0),
    message: z.string().max(1000, "Message must be 1000 characters or fewer").optional(),
  })
  .superRefine((data, ctx) => {
    const problem = (message: string) =>
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: ["slots"],
      });

    if (hasDuplicateSlots(data.slots)) problem("SLOT_DUPLICATE");
    if (slotDayCount(data.slots) > MAX_OFFER_SLOT_DAYS) {
      problem("TOO_MANY_SLOT_DAYS");
    }

    // The slot's **end**, not its start: a driver bidding at 10:00 can still
    // offer this morning, and that is the honest reading of the offer.
    const now = new Date();
    const resolved = resolveOfferSlots(
      data.slots,
      data.deliveryLeadDays,
      data.tzOffset
    );
    if (resolved.some((slot) => slot.endsAt <= now)) problem("SLOT_IN_PAST");
  });

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

/**
 * Award an offer, naming which of its slots is being booked.
 *
 * Optional, and an absent body is valid: an offer carrying one slot has
 * nothing to choose between, and the internal lanes that propose no slot at
 * all take the job's own window.
 */
export const acceptOfferSchema = z.object({
  slotId: z.string().min(1).optional(),
});

export type AcceptOfferInput = z.infer<typeof acceptOfferSchema>;

/** Query for listing offers. Sort is only honoured for the shipper view. */
export const listOffersQuerySchema = z.object({
  sort: z.enum(OFFER_SORT_VALUES).default("price_asc"),
});

export type ListOffersQuery = z.infer<typeof listOffersQuerySchema>;

export const carrierOffersQuerySchema = z.object({
  status: z
    .enum(["pending", "accepted", "rejected", "withdrawn", "expired"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CarrierOffersQuery = z.infer<typeof carrierOffersQuerySchema>;

// ========================================
// Output shapes
// ========================================

/**
 * What a carrier looks like to the shipper comparing offers. Deliberately
 * excludes contact details and every KYC field - the shipper sees a
 * reputation, not an identity document (offers_engine_spec.md §3).
 */
export const offerCarrierPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  rating: z.number(),
  completedJobs: z.number(),
  companyName: z.string().nullable(),
});

export const offerVehiclePublicSchema = z.object({
  id: z.string(),
  type: z.string(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  maxWeightKg: z.number(),
});

/** A proposal as it is read back: the words the driver used and the instants. */
export const offerSlotOutputSchema = z.object({
  id: z.string(),
  day: z.string(),
  slot: z.enum(TIME_SLOTS),
  startsAt: z.date(),
  endsAt: z.date(),
  deliveryAt: z.date(),
});

export const offerOutputSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  priceCents: z.number(),
  /** The booked slot - the earliest proposed, until one is chosen on award. */
  estimatedPickup: z.date(),
  estimatedDelivery: z.date(),
  deliveryLeadDays: z.number(),
  slots: z.array(offerSlotOutputSchema),
  message: z.string().nullable(),
  status: z.enum(["pending", "accepted", "rejected", "withdrawn", "expired"]),
  createdAt: z.date(),
  carrier: offerCarrierPublicSchema,
  vehicle: offerVehiclePublicSchema,
});

export type OfferOutput = z.infer<typeof offerOutputSchema>;

/** What a non-participant sees: the shape of the competition, not the bids. */
export const offerAggregateSchema = z.object({
  offersCount: z.number(),
  lowestPriceCents: z.number().nullable(),
});

export type OfferAggregate = z.infer<typeof offerAggregateSchema>;
