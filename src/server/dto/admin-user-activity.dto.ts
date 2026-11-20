import { z } from "zod";

// ========================================
// A user's requests, offers and conversations, read by staff
// docs/specs/admin_user_management_spec.md §7
// ========================================

/** Every list here is paged at this size, newest first. */
export const ACTIVITY_PAGE_SIZE = 50;

export const activityPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export interface ActivityPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export function toPage<T>(items: T[], page: number, total: number): ActivityPage<T> {
  return {
    items,
    page,
    pageSize: ACTIVITY_PAGE_SIZE,
    total,
    hasMore: page * ACTIVITY_PAGE_SIZE < total,
  };
}

const iso = (value: Date | string) => new Date(value).toISOString();
const isoOrNull = (value: Date | string | null | undefined) => (value ? iso(value) : null);

// ----------------------------------------
// The job, as a line in a list
// ----------------------------------------
// An explicit projection, narrower than the staff `full` view of
// listing-view.ts: towns only. No street, postal code, pin, contact, note or
// requester row ever enters it (CLAUDE.md gotcha 16) — the job page is one
// click away and is where staff read the rest.

export interface ActivityJobRow {
  id: string;
  reference: number;
  title: string;
  pickupCity: string;
  dropoffCity: string;
  status: string;
}

export interface ActivityJobView {
  id: string;
  reference: number;
  title: string;
  pickupCity: string;
  dropoffCity: string;
  status: string;
}

export function toJobView(row: ActivityJobRow): ActivityJobView {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    pickupCity: row.pickupCity,
    dropoffCity: row.dropoffCity,
    status: row.status,
  };
}

// ----------------------------------------
// Requests posted
// ----------------------------------------

export interface ActivityRequestRow extends ActivityJobRow {
  pickupFrom: Date | string;
  expiresAt: Date | string | null;
  offersCount: number;
  createdAt: Date | string;
}

export interface ActivityRequestView extends ActivityJobView {
  pickupFrom: string;
  /** So an open request past its bidding deadline can read « Expirée ». */
  expiresAt: string | null;
  offersCount: number;
  createdAt: string;
}

export function toRequestView(row: ActivityRequestRow): ActivityRequestView {
  return {
    ...toJobView(row),
    pickupFrom: iso(row.pickupFrom),
    expiresAt: isoOrNull(row.expiresAt),
    offersCount: row.offersCount,
    createdAt: iso(row.createdAt),
  };
}

// ----------------------------------------
// Offers made as a transporter
// ----------------------------------------

export interface ActivityOfferRow {
  id: string;
  priceCents: number;
  status: string;
  createdAt: Date | string;
  job: ActivityJobRow;
}

export interface ActivityOfferView {
  id: string;
  priceCents: number;
  status: string;
  createdAt: string;
  job: ActivityJobView;
}

export function toOfferView(row: ActivityOfferRow): ActivityOfferView {
  return {
    id: row.id,
    priceCents: row.priceCents,
    status: row.status,
    createdAt: iso(row.createdAt),
    job: toJobView(row.job),
  };
}

// ----------------------------------------
// Conversations
// ----------------------------------------

export interface ActivityPartyRow {
  id: string;
  name: string;
}

export interface ActivityConversationRow {
  id: string;
  type: string;
  lastMessageAt: Date | string | null;
  createdAt: Date | string;
  job: ActivityJobRow | null;
  others: ActivityPartyRow[];
  messageCount: number;
}

export interface ActivityConversationView {
  id: string;
  type: string;
  lastMessageAt: string | null;
  createdAt: string;
  job: ActivityJobView | null;
  /** Everyone in the thread but the account being looked at. */
  others: ActivityPartyRow[];
  messageCount: number;
}

export function toConversationView(row: ActivityConversationRow): ActivityConversationView {
  return {
    id: row.id,
    type: row.type,
    lastMessageAt: isoOrNull(row.lastMessageAt),
    createdAt: iso(row.createdAt),
    job: row.job ? toJobView(row.job) : null,
    others: row.others.map((party) => ({ id: party.id, name: party.name })),
    messageCount: row.messageCount,
  };
}

// ----------------------------------------
// Messages of one conversation
// ----------------------------------------

export interface ActivityMessageRow {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  attachmentUrl: string | null;
  createdAt: Date | string;
  offerPriceCents: number | null;
  offerStatus: string | null;
}

export interface ActivityMessageView {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  /** Said, not served: the file itself stays with the two participants. */
  hasAttachment: boolean;
  createdAt: string;
  /** Set when the message carries a thread offer — price and current status. */
  offer: { priceCents: number; status: string } | null;
}

export function toMessageView(row: ActivityMessageRow): ActivityMessageView {
  const hasOffer = row.offerPriceCents !== null && row.offerStatus !== null;
  return {
    id: row.id,
    senderId: row.senderId,
    senderName: row.senderName,
    content: row.content,
    hasAttachment: Boolean(row.attachmentUrl),
    createdAt: iso(row.createdAt),
    offer: hasOffer
      ? { priceCents: row.offerPriceCents as number, status: row.offerStatus as string }
      : null,
  };
}

// ----------------------------------------
// Summary and thread envelopes
// ----------------------------------------

export interface ActivitySummaryView {
  user: { id: string; name: string; email: string };
  counts: { requests: number; offers: number; conversations: number };
}

export interface ActivityThreadView {
  conversation: ActivityConversationView;
  messages: ActivityPage<ActivityMessageView>;
}
