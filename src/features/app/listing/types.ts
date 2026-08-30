/** Shapes returned by the transport-job REST layer. */

import type { TimeSlot } from "@/lib/availability-window";

export type ListingStatus =
  | "draft"
  | "open"
  | "awarded"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

export type OfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "expired";

export interface JobEndpoint {
  lat: number;
  lng: number;
  address: string;
  city: string;
  postalCode: string;
  locationType: string;
  floor: number | null;
  hasLift: boolean | null;
}

export interface Job {
  id: string;
  shipperId: string;
  status: ListingStatus;
  title: string;
  description: string;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  quantity: number;
  isFragile: boolean;
  needsHelp: boolean;

  pickupAddress: string;
  pickupCity: string;
  pickupPostalCode: string;
  pickupLocationType: string;
  pickupLat: number;
  pickupLng: number;

  dropoffAddress: string;
  dropoffCity: string;
  dropoffPostalCode: string;
  dropoffLocationType: string;
  dropoffLat: number;
  dropoffLng: number;

  pickupFrom: string;
  pickupUntil: string;
  dropoffFrom: string;
  dropoffUntil: string;
  isFlexible: boolean;

  budgetCents: number;
  acceptedOfferId: string | null;
  origin: "direct" | "expedion";

  offersCount: number;
  views: number;
  expiresAt: string;
  createdAt: string;

  /**
   * Lowest `order` first — `photosInOrder` in `listings.dal.ts` sorts the
   * relation, rather than leaving Postgres to return the rows however it
   * likes. `order` is the position the requester uploaded the photo at, so the
   * first is the one they led with, and the one the job board shows.
   */
  photos?: { id: string; url: string; order: number }[];
  category?: { id: string; name: string } | null;
  shipper?: { id: string; name: string; image: string | null; rating: number };

  /**
   * Set once a shipment for this job reached `DELIVERED`, and null otherwise -
   * including for a job whose own status reads `completed` with no delivered
   * shipment behind it. The shipment is the fact; the listing status is a
   * consequence written separately (my_requests_history_spec.md §3).
   */
  delivery?: JobDelivery | null;
}

/** The transporter who carried a job, as the requester is allowed to see them. */
export interface JobDeliveryCarrier {
  id: string;
  name: string;
  image: string | null;
  rating: number;
}

export interface JobDelivery {
  shipmentId: string;
  /** Null only for a row delivered before the column was stamped. */
  deliveredAt: string | null;
  /** The agreed price, from the accepted offer. */
  priceCents: number;
  /** A live `shipment_photos` row exists at stage `delivery`. */
  hasProofOfDelivery: boolean;
  /** Null when the carrier's user row no longer resolves. */
  carrier: JobDeliveryCarrier | null;
}

export interface OfferCarrier {
  id: string;
  name: string;
  image: string | null;
  rating: number;
}

export interface OfferVehicle {
  id: string;
  type: string;
  make: string | null;
  model: string | null;
  maxWeightKg: number;
}

/** One time slot a carrier proposed: a day, a time of day, and the instants. */
export interface OfferSlot {
  id: string;
  day: string;
  slot: TimeSlot;
  startsAt: string;
  endsAt: string;
  deliveryAt: string;
}

export interface Offer {
  id: string;
  listingId: string;
  priceCents: number;
  /** The booked slot - the earliest proposed, until one is chosen on award. */
  estimatedPickup: string;
  estimatedDelivery: string;
  deliveryLeadDays: number;
  slots: OfferSlot[];
  message: string | null;
  status: OfferStatus;
  createdAt: string;
  carrier: OfferCarrier;
  vehicle: OfferVehicle;
}

/**
 * What the offers endpoint returns depends on who asked
 * (docs/specs/offers_engine_spec.md §6).
 */
export type OffersResponse =
  | { scope: "full"; offers: Offer[] }
  | { scope: "own"; offers: Offer[] }
  | { scope: "aggregate"; offersCount: number; lowestPriceCents: number | null };

export interface BrowseResult {
  items: Job[];
  total: number;
}
