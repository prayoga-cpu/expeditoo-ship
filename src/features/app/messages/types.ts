/**
 * Messages feature types
 * Following SOLID principle - centralized type definitions
 */

export interface Message {
  id: string;
  /** « @pseudo » when the person chose one, their name otherwise (#32). */
  name: string;
  /** « NM »: what the avatar shows without a photo (lib/initials.ts). */
  initials?: string;
  avatar?: string;
  listing: string;
  snippet: string;
  timestamp: string;
  unread: boolean;
  type?: "LISTING" | "SUPPORT"; // Chat type for badge display
  /** The job the thread is about, when it is about one. */
  listingId?: string;
  /** « Paris → Lyon », when the thread is about a job. */
  route?: string;
  /** « 20 nov. – 22 nov. »: the pickup day, then the delivery day. */
  dates?: string;
}

/**
 * A job the Messages search offers as a one-tap filter (§D5): one the viewer
 * has a thread about, or one of their own live requests.
 */
export interface ListingChip {
  id: string;
  /** « Paris → Clamart ». */
  route: string;
  title: string;
  /** Whether it is the viewer's own request — they can go and find carriers. */
  own: boolean;
}



export interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  sentByMe: boolean;
  readByOther?: boolean; // Read receipt: true if the other person has seen this message
  /**
   * Who wrote it, as the avatar beside the bubble is named: « @pseudo », or
   * their name. The initials stay those of the real name.
   */
  senderName?: string;
  senderInitials?: string;
  senderAvatar?: string;
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
    /** Which slots the bid proposes; absent where a projection does not load them. */
    slots?: { id: string }[];
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
  | "CARRIER_ABSENT"
  | "OWN_LISTING"
  | "LISTING_NOT_OPEN"
  | "LISTING_EXPIRED"
  | "OFFER_LIVE"
  | "OFFER_SLOT_BURNT"
  | "IN_HOUSE_DRIVER";

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
  /**
   * Whether the viewer may answer a bid with a counter-price on the job page:
   * the requester of a direct request still open (thread_offer_spec.md §13).
   */
  canCounter: boolean;
}

export interface Conversation {
  id: string;
  recipient: {
    /** The full name: what the thread header says. */
    name: string;
    /** « @pseudo », shown muted beside the name in the header; absent without one. */
    pseudo?: string;
    /** The pseudo, else the name: what a bubble's avatar is called (#32). */
    displayName?: string;
    /** « NM », for the header avatar and the bubbles beside their messages. */
    initials?: string;
    avatar?: string;
    rating?: number;
    reviewsCount?: number;
  };
  listing: string;
  /** The job's « Réf. », when the thread is about one. */
  listingReference?: number;
  listingImage?: string;
  /** The job's id, for the header's link to it. */
  listingId?: string;
  /** « Paris → Lyon » and « 20 nov. – 22 nov. », for the pinned job row. */
  listingRoute?: string;
  listingDates?: string;
  messages: ChatMessage[];
  offerContext?: ThreadOfferContext | null;
}
