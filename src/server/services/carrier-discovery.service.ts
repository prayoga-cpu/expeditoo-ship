import {
  carrierRoutesDal,
  type MatchCandidateRow,
} from "@/server/dal/carrier-routes.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { messagesService } from "@/server/services/messages.service";
import { hasAnyRole } from "@/server/services/user.service";
import {
  carrierMatchSchema,
  type CarrierMatch,
  type CarrierMatchList,
} from "@/server/dto/carrier-discovery.dto";
import {
  MAX_MATCHES,
  MAX_MATCH_CANDIDATES,
  matchRoute,
  type MatchTarget,
  type RouteMatch,
} from "@/lib/route-match";

// ========================================
// Carrier Discovery Service
// ========================================
// Which approved carriers already drive a job's trajet, and the one tap that
// starts the conversation. A discovery surface, not a second award path: it
// writes no offer, moves no money and changes no status, and its only write of
// any kind is the opening message (carriers_on_route_spec.md §8).

// ========================================
// Errors
// ========================================

export class CarrierDiscoveryError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "CarrierDiscoveryError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new CarrierDiscoveryError(code, status, message);

type ListingRow = NonNullable<Awaited<ReturnType<typeof listingsDal.getById>>>;

/** One trajet that covers the job, with what the predicate found. */
interface RankedMatch {
  row: MatchCandidateRow;
  match: RouteMatch;
}

// ========================================
// The gate
// ========================================

/**
 * Who may see the carriers on a job's route: whoever posted it, or — on an
 * escalated job, whose owner is a system account nobody signs into — an
 * operator standing in for the Expedion client. The same fork
 * `offersService.acceptOffer` makes, for the same reason.
 *
 * The listing is read through the DAL rather than `listingsService.getListing`
 * because that one increments `listings.views`, and this service is not
 * allowed a write beyond the message it sends.
 */
async function requireDiscoveryAccess(userId: string, listingId: string) {
  const listing = await listingsDal.getById(listingId);
  if (!listing) throw err("LISTING_NOT_FOUND", 404);

  if (listing.shipperId !== userId) {
    if (listing.origin !== "expedion") throw err("NOT_LISTING_OWNER", 403);

    const isStaff = await hasAnyRole(userId, ["operator", "admin"]);
    if (!isStaff) throw err("NOT_LISTING_OWNER", 403);
  }

  // A draft takes no offers and is not on the board, so "des transporteurs
  // vous contacteront" would be a false promise there.
  if (listing.status !== "open") throw err("LISTING_NOT_OPEN", 409);

  return listing;
}

// ========================================
// Matching
// ========================================

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Every trajet that covers this job, before deduplication.
 *
 * The SQL prefilter narrows the set; `matchRoute` decides it. The window the
 * prefilter is given is the one the predicate will use — the later of today
 * and the job's opening day — so a stored date it admits is one the predicate
 * can still accept.
 *
 * The viewer is dropped from their own results. Nothing stops a requester also
 * being an approved carrier who declared a trajet along the job they posted, and
 * a card offering to introduce someone to themselves is the least of it:
 * `messagesDAL.findConversation(u, u, listingId)` asks for a conversation this
 * user is a participant of twice, which **any** of their threads about this
 * listing satisfies — so `contact` would have posted the opening line into some
 * other carrier's thread.
 */
async function matchesFor(
  listing: ListingRow,
  viewerId: string
): Promise<RankedMatch[]> {
  const now = new Date();
  const job: MatchTarget = {
    pickup: { lat: listing.pickupLat, lng: listing.pickupLng },
    dropoff: { lat: listing.dropoffLat, lng: listing.dropoffLng },
    pickupFrom: listing.pickupFrom,
    pickupUntil: listing.pickupUntil,
    weightKg: listing.weightKg,
  };

  const candidates = await carrierRoutesDal.findMatchCandidates(
    {
      pickup: job.pickup,
      dropoff: job.dropoff,
      weightKg: job.weightKg,
      windowStart: startOfDay(
        now > listing.pickupFrom ? now : listing.pickupFrom
      ),
      windowEnd: listing.pickupUntil,
    },
    MAX_MATCH_CANDIDATES
  );

  return candidates
    .filter((row) => row.userId !== viewerId)
    .map((row) => ({ row, match: matchRoute(row, job, now) }))
    .filter((entry): entry is RankedMatch => entry.match !== null);
}

/**
 * One card per carrier, best trajet first.
 *
 * A carrier may hold several trajets covering the same job; showing three
 * cards for one driver would read as three drivers. The smallest `detourKm`
 * wins the seat, and ties go to the better-rated carrier.
 */
function rank(matches: RankedMatch[]): RankedMatch[] {
  const best = new Map<string, RankedMatch>();

  for (const entry of matches) {
    const held = best.get(entry.row.carrierId);
    if (!held || entry.match.detourKm < held.match.detourKm) {
      best.set(entry.row.carrierId, entry);
    }
  }

  return [...best.values()].sort(
    (a, b) =>
      a.match.detourKm - b.match.detourKm ||
      b.row.averageRating - a.row.averageRating
  );
}

/**
 * A run as the calendar day it is, `YYYY-MM-DD`.
 *
 * `upcomingOccurrences` returns local midnight, so `toISOString()` named the
 * previous day on any server east of UTC. Production runs `TZ=UTC` and would
 * have hidden that indefinitely; a laptop in UTC+8 shows it on the first card.
 * A trajet runs on a day rather than at an instant (spec §8), so the day is
 * what crosses the wire.
 */
const toDayString = (run: Date) =>
  `${run.getFullYear()}-${String(run.getMonth() + 1).padStart(2, "0")}-${String(
    run.getDate()
  ).padStart(2, "0")}`;

/**
 * The row spread in whole on purpose: `carrierMatchSchema` is what strips it,
 * so a private column added to the prefilter later cannot reach the wire by
 * being forgotten here (carriers_on_route_spec.md §4.3).
 */
function toMatch(entry: RankedMatch): CarrierMatch {
  return carrierMatchSchema.parse({
    ...entry.row,
    matchId: entry.row.routeId,
    displayName: entry.row.userName,
    avatarUrl: entry.row.userImage,
    rating: entry.row.averageRating,
    reviewCount: entry.row.totalRatings,
    nextRuns: entry.match.runs.map(toDayString),
    detourKm: Math.round(entry.match.detourKm),
  });
}

// ========================================
// The opening message
// ========================================

const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
});

/**
 * The requester's own first line, not a UI string — it is the text of a
 * message they are sending, which is why it lives here rather than in a
 * catalogue. French because the product is French; the recipient reads it as
 * written whatever locale either side is browsing in.
 */
function openingMessage(listing: ListingRow) {
  return (
    `Bonjour, je cherche un transporteur pour « ${listing.title} », ` +
    `${listing.pickupCity} → ${listing.dropoffCity}, entre le ` +
    `${dayFormat.format(listing.pickupFrom)} et le ` +
    `${dayFormat.format(listing.pickupUntil)}. Seriez-vous disponible ?`
  );
}

// ========================================
// Service
// ========================================

export const carrierDiscoveryService = {
  async listForListing(
    userId: string,
    listingId: string
  ): Promise<CarrierMatchList> {
    const listing = await requireDiscoveryAccess(userId, listingId);
    const ranked = rank(await matchesFor(listing, userId));

    // The count is carriers, not trajets, and it is taken before the display
    // cap — it is the number the tab badge shows.
    return {
      items: ranked.slice(0, MAX_MATCHES).map(toMatch),
      total: ranked.length,
    };
  },

  /**
   * Open a thread with one of them.
   *
   * The match is re-run rather than looked up, and that re-run **is** the
   * authorisation (spec §6.2): a `matchId` the predicate does not return is
   * refused, so the endpoint can only ever reach a carrier who genuinely
   * covers this job and cannot be walked as a carrier directory. Deduplication
   * and the display cap are presentation, so a trajet dropped by either is
   * still a legitimate match here.
   *
   * `carrier_routes.carrier_id` is a `carriers.id`, while a conversation is
   * between `user` rows — `carriers.user_id` is the bridge, resolved
   * server-side so no requester is ever handed a user id.
   */
  async contact(userId: string, listingId: string, matchId: string) {
    const listing = await requireDiscoveryAccess(userId, listingId);

    const found = (await matchesFor(listing, userId)).find(
      (entry) => entry.row.routeId === matchId
    );
    if (!found) throw err("MATCH_NOT_FOUND", 404);

    // `sendMessage`, never `/api/messages/init`: init stamps `lastMessageAt`
    // on an empty conversation, which `getUnreadCount` counts, so every tap
    // would raise a phantom unread badge on both sides — and it publishes
    // nothing, so the carrier would never learn they had been contacted.
    // `listingId` puts the thread on the job lane of `contextFor`, where a
    // bubble offer mints a real `offers` row (spec §6.4).
    const { conversationId } = await messagesService.sendMessage(userId, {
      recipientId: found.row.userId,
      listingId: listing.id,
      content: openingMessage(listing),
    });
    if (!conversationId) throw err("CONTACT_FAILED", 500);

    return { conversationId };
  },
};
