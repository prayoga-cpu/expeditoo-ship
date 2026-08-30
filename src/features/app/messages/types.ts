/**
 * Messages feature types
 * Following SOLID principle - centralized type definitions
 */

export interface Message {
  id: string;
  name: string;
  avatar?: string;
  listing: string;
  snippet: string;
  timestamp: string;
  unread: boolean;
  type?: "LISTING" | "SUPPORT"; // Chat type for badge display
}



export interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  sentByMe: boolean;
  readByOther?: boolean; // Read receipt: true if the other person has seen this message
  /**
   * The formal price this message carries, if any. Present means the thread
   * renders a card instead of a bubble - it is the whole discriminator.
   * See docs/specs/thread_offer_spec.md §3.2.
   */
  offer?: ThreadOfferView;
}

/** One of the three times of day an offer can name. */
export type ThreadOfferSlot = "morning" | "afternoon" | "evening";

/** What the card shows. Status is the joined bid's on the job lane. */
export interface ThreadOfferView {
  id: string;
  priceCents: number;
  pickupDay: string;
  pickupSlot: ThreadOfferSlot;
  deliveryLeadDays: number;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  note: string | null;
  senderId: string;
  /** Set on the job lane: the real bid this offer became. */
  offer: {
    id: string;
    listingId: string;
    status: "pending" | "accepted" | "rejected" | "withdrawn" | "expired";
  } | null;
  vehicle: {
    id: string;
    type: string;
    make: string | null;
    model: string | null;
  } | null;
}

/** Why the composer shows - or hides - the offer button. */
export type ThreadOfferBlock =
  | "NOT_A_CARRIER"
  | "NOT_APPROVED"
  | "OWN_LISTING"
  | "LISTING_NOT_OPEN"
  | "LISTING_EXPIRED"
  | "OFFER_LIVE"
  | "OFFER_SLOT_BURNT";

export interface ThreadOfferJob {
  id: string;
  title: string;
  budgetCents: number;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  pickupFrom: string;
  pickupUntil: string;
  isFlexible: boolean;
}

/**
 * Computed once on the server so no client re-derives a permission, and all
 * three shells agree. See docs/specs/thread_offer_spec.md §7.
 */
export interface ThreadOfferContext {
  lane: "job" | "standalone";
  canOffer: boolean;
  blockedBy: ThreadOfferBlock | null;
  job: ThreadOfferJob | null;
  viewerCanAward: boolean;
}

export interface Conversation {
  id: string;
  recipient: {
    name: string;
    avatar?: string;
    rating?: number;
    reviewsCount?: number;
  };
  listing: string;
  listingImage?: string;
  messages: ChatMessage[];
  offerContext?: ThreadOfferContext | null;
}
