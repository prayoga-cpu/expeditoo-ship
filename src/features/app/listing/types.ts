/** Shapes returned by the transport-job REST layer. */

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

  photos?: { id: string; url: string; order: number }[];
  category?: { id: string; name: string } | null;
  shipper?: { id: string; name: string; image: string | null; rating: number };
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

export interface Offer {
  id: string;
  listingId: string;
  priceCents: number;
  estimatedPickup: string;
  estimatedDelivery: string;
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
