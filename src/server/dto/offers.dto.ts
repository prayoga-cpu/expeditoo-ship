import { z } from "zod";

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

/**
 * Submit an offer.
 *
 * Cross-field rules that need only the input itself are refined here. Rules
 * needing the listing or the vehicle (pickup window, vehicle capacity) belong
 * to the service, which has those rows.
 */
export const createOfferSchema = z
  .object({
    vehicleId: z.string().min(1, "Vehicle is required"),
    priceCents: priceCentsSchema,
    estimatedPickup: z.coerce.date(),
    estimatedDelivery: z.coerce.date(),
    message: z.string().max(1000, "Message must be 1000 characters or fewer").optional(),
  })
  .refine((data) => data.estimatedPickup < data.estimatedDelivery, {
    message: "DELIVERY_BEFORE_PICKUP",
    path: ["estimatedDelivery"],
  })
  .refine((data) => data.estimatedPickup >= new Date(), {
    message: "PICKUP_IN_PAST",
    path: ["estimatedPickup"],
  });

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

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

export const offerOutputSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  priceCents: z.number(),
  estimatedPickup: z.date(),
  estimatedDelivery: z.date(),
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
