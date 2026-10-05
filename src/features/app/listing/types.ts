/** Shapes returned by the transport-job REST layer. */

import type { IsoWeekday, TimeSlot } from "@/lib/availability-window";

export type ListingStatus =
  | "draft"
  | "open"
  | "awarded"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired"
  | "scheduled";

export type OfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "expired";

export interface JobEndpoint {
  lat: number | null;
  lng: number | null;
  address: string;
  city: string;
  postalCode: string;
  locationType: string;
  floor: number | null;
  hasLift: boolean | null;
}

export interface Job {
  id: string;
  /**
   * « Réf. 100042 »: the number people quote to each other for this job.
   * Issued by the database, never edited (listing_reference_spec.md).
   */
  reference: number;
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
  packagingLevel: "protected" | "boxed" | null;
  needsProtection: boolean;
  needsPackaging: boolean;

  /**
   * The street, for the owner, staff and approved carriers only; others read
   * the city and the postal code (listing_privacy_spec.md §1).
   */
  pickupAddress?: string;
  pickupCity: string;
  pickupPostalCode: string;
  pickupLocationType: string;
  // Null when the requester typed the address by hand with no map pin and
  // no pasted link — the job is still real, it just has no coordinates.
  pickupLat: number | null;
  pickupLng: number | null;

  dropoffAddress?: string;
  dropoffCity: string;
  dropoffPostalCode: string;
  dropoffLocationType: string;
  dropoffLat: number | null;
  dropoffLng: number | null;

  pickupFrom: string;
  pickupUntil: string;
  dropoffFrom: string;
  dropoffUntil: string;
  isFlexible: boolean;
  /**
   * Who is there, when: ISO weekdays and times of day at each end. The full
   * set means unrestricted. Optional because two projections
   * (`messages.dal.ts`, `thread-offers.service.ts`) build a job without them,
   * and an absent set reads as unrestricted (request_availability_spec.md §3).
   */
  pickupDays?: IsoWeekday[];
  pickupPeriods?: TimeSlot[];
  dropoffDays?: IsoWeekday[];
  dropoffPeriods?: TimeSlot[];

  budgetCents: number;
  /** Owner and staff only: absent from anyone else's view (listing_privacy_spec.md §2). */
  acceptedOfferId?: string | null;
  origin: "direct" | "expedion";

  offersCount: number;
  views: number;
  expiresAt: string;
  /**
   * Set when a transporter withdrew and the job came back. Its bidding window
   * was extended and its pickup window may have slid forward, so it is not the
   * job that was posted — and a carrier bidding on it is entitled to know.
   */
  reopenedAt: string | null;
  /** Set while status is `scheduled`: the moment it goes live. */
  scheduledPublishAt?: string | null;
  /** When it first went live; null while a draft or scheduled (0036). */
  publishedAt?: string | null;
  createdAt: string;
  updatedAt?: string;

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

/**
 * A request that has not gone live, as its owner reads it to finish it: the
 * street, the access details, the contacts and the schedule included
 * (draft_requests_spec.md §2, listing_privacy_spec.md §1 "full").
 */
export interface DraftJob extends Job {
  pickupAddress: string;
  dropoffAddress: string;
  pickupFloor: number | null;
  pickupHasLift: boolean | null;
  pickupNote: string | null;
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  dropoffFloor: number | null;
  dropoffHasLift: boolean | null;
  dropoffNote: string | null;
  dropoffContactName: string | null;
  dropoffContactPhone: string | null;
  scheduledPublishAt: string | null;
  updatedAt: string;
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
