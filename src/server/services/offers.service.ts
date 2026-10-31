import { nanoid } from "nanoid";
import { mayTakeWork } from "@/lib/carrier-availability";
import { getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { offersDal } from "@/server/dal/offers.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { userHasRole } from "@/server/dal/users.dal";
import { notificationsService } from "@/server/services/notifications.service";
import { driverAlertsService } from "@/server/services/driver-alerts.service";
import { listingPinsService } from "@/server/services/listing-pins.service";
import { paymentsService } from "@/server/services/payments.service";
import { stripeService } from "@/server/services/stripe.service";
import {
  expedionBridgeService,
  notifyExpedion,
} from "@/server/services/expedion-bridge.service";
import {
  overlapsWindow,
  resolveOfferSlots,
  type ResolvedOfferSlot,
} from "@/lib/offer-slots";
import {
  biddingRunsUntil,
  rearmedExpiry,
  rearmedWindow,
} from "@/lib/listing-window";
import { PARTY_FIELDS, project, toListingView } from "@/server/services/listing-view";
import {
  MAX_COUNTER_ROUNDS,
  type CounterOfferInput,
  type CounterResponseInput,
  type CreateOfferInput,
  type PreparePaymentInput,
} from "@/server/dto/offers.dto";
import type { InsertListing, Listing } from "@/db/schema/listings";
import { offers, type Offer } from "@/db/schema/offers";
import type { Vehicle } from "@/db/schema/carriers";

// ========================================
// Errors
// ========================================
// Each maps to one status/code pair in docs/specs/offers_engine_spec.md.

export class OfferError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "OfferError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new OfferError(code, status, message);

// ========================================
// Guards
// ========================================

/** What the carrier proposed, and the pair the offer row stores for it. */
interface OfferSchedule {
  slots: ResolvedOfferSlot[];
  estimatedPickup: Date;
  estimatedDelivery: Date;
}

/**
 * The carrier's proposed slots, checked against the job and turned into the
 * schedule the offer row carries.
 *
 * **Every** slot must overlap the pickup window, not merely one of them: an
 * offer is refused whole rather than having a proposal silently dropped. The
 * form does not let a driver reach this state — days outside the window are
 * disabled in the calendar.
 *
 * Overlap rather than containment, matching the board filter
 * (board_route_search_spec.md §5): a morning against a window opening at 09:00
 * is a real proposal, and demanding containment would mean no driver could
 * offer the first morning of any job.
 */
function resolveSchedule(data: CreateOfferInput, listing: Listing): OfferSchedule {
  // No proposal: the job's own window. The DTO requires at least one slot, so
  // only the internal lanes reach this — `takeJob` and `assignDirect`, where
  // the driver is accepting the job as posted rather than proposing anything
  // (offer_time_slots_spec.md §3.4).
  if (data.slots.length === 0) {
    return {
      slots: [],
      estimatedPickup: listing.pickupFrom,
      estimatedDelivery: listing.dropoffFrom,
    };
  }

  const slots = resolveOfferSlots(
    data.slots,
    data.deliveryLeadDays,
    data.tzOffset
  );

  const window = { from: listing.pickupFrom, until: listing.pickupUntil };
  if (!listing.isFlexible && !slots.every((s) => overlapsWindow(s, window))) {
    throw err("PICKUP_OUTSIDE_WINDOW", 400);
  }

  // The earliest, so `pickup_asc` still sorts by when the job actually starts.
  return {
    slots,
    estimatedPickup: slots[0].startsAt,
    estimatedDelivery: slots[0].deliveryAt,
  };
}

/**
 * Validates the parts of an offer that need the vehicle.
 * Purely-input rules live in the DTO; timing lives in `resolveSchedule`.
 */
function assertVehicleFitsJob(listing: Listing, vehicle: Vehicle): void {
  if (vehicle.maxWeightKg < listing.weightKg) {
    throw err("VEHICLE_CAPACITY_WEIGHT", 400);
  }

  // Dimensions are optional on both sides; only compare when both are known.
  const overflows = (
    [
      [listing.lengthCm, vehicle.maxLengthCm],
      [listing.widthCm, vehicle.maxWidthCm],
      [listing.heightCm, vehicle.maxHeightCm],
    ] as const
  ).some(([needed, available]) =>
    needed != null && available != null ? available < needed : false
  );

  if (overflows) throw err("VEHICLE_CAPACITY_DIMENSIONS", 400);
}

function assertListingOpen(listing: Listing | undefined): asserts listing {
  if (!listing) throw err("LISTING_NOT_FOUND", 404);
  if (listing.status !== "open") throw err("LISTING_NOT_OPEN", 409);
  if (listing.expiresAt <= new Date()) throw err("LISTING_EXPIRED", 409);
}

/** What a requester needs of a bidder's vehicle: what it is and what it carries. */
const VEHICLE_FIELDS = [
  "id",
  "type",
  "make",
  "model",
  "maxWeightKg",
  "maxLengthCm",
  "maxWidthCm",
  "maxHeightCm",
] as const;

/**
 * A bid as its requester (or staff) reads it: the carrier as a name, a face
 * and a rating, the vehicle without its plate. The DAL loads both whole
 * (listing_privacy_spec.md §3).
 */
function asSeenByRequester<T extends { carrier?: unknown; vehicle?: unknown }>(offer: T) {
  return withoutProposer({
    ...offer,
    carrier: project(offer.carrier, PARTY_FIELDS),
    vehicle: project(offer.vehicle, VEHICLE_FIELDS),
  });
}

/**
 * Drops `proposedBy`: which staff account recommended an offer is the back
 * office's business. `proposedAt` is what the screens read (§B1).
 */
function withoutProposer<T>(offer: T): Omit<T, "proposedBy"> {
  const { proposedBy: _proposedBy, ...rest } = offer as T & {
    proposedBy?: unknown;
  };
  return rest as Omit<T, "proposedBy">;
}

export { MAX_COUNTER_ROUNDS };

/** A pending offer on a job still taking offers — what B1 and B6 act on. */
async function loadNegotiable(offerId: string) {
  const offer = await offersDal.getById(offerId);
  if (!offer) throw err("OFFER_NOT_FOUND", 404);
  if (offer.status !== "pending") throw err("OFFER_NOT_PENDING", 409);
  const listing = await listingsDal.getById(offer.listingId);
  if (!listing) throw err("LISTING_NOT_FOUND", 404);
  if (listing.status !== "open" || listing.acceptedOfferId) {
    throw err("LISTING_NOT_OPEN", 409);
  }
  return { offer, listing };
}

const euroLabel = (cents: number) => `${(cents / 100).toFixed(2)} €`;

/** In-app only, best-effort: a failed notice never fails the negotiation. */
async function notify(
  userId: string,
  type: string,
  n: { title: string; message: string; listingId: string; offerId: string }
) {
  await notificationsService
    .createNotification({
      userId,
      type,
      title: n.title,
      message: n.message,
      linkUrl: `/listing/${n.listingId}`,
      data: { listingId: n.listingId, offerId: n.offerId },
    })
    .catch((e) => console.error(`${type} notification failed`, e));
}

/** An offer's own columns: the row, without anything the DAL loads beside it. */
const OFFER_COLUMNS = Object.keys(getTableColumns(offers));

/**
 * An award as its HTTP caller reads it — the requester accepting and the
 * carrier taking alike: the offer as its own row, the shipment by id, and
 * whether this call is the one that made the award.
 *
 * Never the rest of what `acceptOffer` returns. `rejectedOffers` is every
 * rival's bid — price, message, vehicle, user id — and a carrier sees only
 * their own (offers_engine_spec.md §6); `payment` is the platform's row,
 * commission included; and on the idempotent branch the offer comes from
 * `offersDal.getById`, with the carrier's whole `user` row and the plate
 * (listing_privacy_spec.md §3). Those stay inside the service, for
 * `notifyAwardOutcome`, the compensation and `assignDirect`.
 */
function toAwardView(award: {
  offer: unknown;
  shipment?: { id: string } | null;
  alreadyAccepted: boolean;
}) {
  return {
    offer: project(award.offer, OFFER_COLUMNS),
    shipment: award.shipment ? { id: award.shipment.id } : null,
    alreadyAccepted: award.alreadyAccepted,
  };
}

/**
 * An approved carrier account is the licence to bid — and an absent driver has
 * put theirs down for a while (client_feedback_2026_10_29_spec.md §REQ-02).
 */
async function requireApprovedCarrier(userId: string) {
  const carrier = await carriersDal.getByUserId(userId);
  if (!carrier) throw err("CARRIER_NOT_APPROVED", 403);
  if (carrier.status !== "approved") throw err("CARRIER_NOT_APPROVED", 403);
  if (!mayTakeWork(carrier)) throw err("CARRIER_ABSENT", 403);
  return carrier;
}

type OfferWithSlots = NonNullable<Awaited<ReturnType<typeof offersDal.getById>>>;

/**
 * Which of the carrier's proposed slots is being booked.
 *
 * Named, it must be one of the offer's and still ahead. Absent, it is the
 * earliest slot **still ahead** — not simply the earliest. Until 2.63.0 an
 * offer was all but always answered before its first slot came round, because
 * bidding closed six hours before the job's window opened; a flexible direct
 * request now takes offers until its window *ends* (client_feedback_2026_10_spec.md
 * §4), so a requester accepting in the chat bubble — which names no slot —
 * could otherwise book a day already gone, and pay for it. An offer with no
 * slot left ahead is refused before any card is touched. The lanes that
 * propose no slot at all (`takeJob`, `assignDirect`) book the job's own window.
 */
function bookedSlot(offer: OfferWithSlots, slotId?: string) {
  const now = new Date();

  if (slotId) {
    const booked = offer.slots.find((slot) => slot.id === slotId);
    if (!booked) throw err("SLOT_NOT_ON_OFFER", 400);
    // `SLOT_IN_PAST` is a submit-time rule (offers.dto.ts) too, but a restored
    // bid or a long flexible window can put a proposed slot behind us by the
    // time anyone answers it; booking it would write a past
    // `scheduled_pickup` and report a past pickup date to the client.
    if (booked.startsAt <= now) throw err("SLOT_IN_PAST", 409);
    return booked;
  }

  if (!offer.slots?.length) return undefined;
  const ahead = [...offer.slots]
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .find((slot) => slot.startsAt > now);
  if (!ahead) throw err("SLOT_IN_PAST", 409);
  // The earliest still ahead is usually the earliest, which the offer already
  // stores as its pair: nothing to rewrite then.
  return ahead.startsAt.getTime() === offer.estimatedPickup.getTime() ? undefined : ahead;
}

/**
 * Who may award depends on where the job came from.
 *
 * A direct listing is awarded by the shipper who posted it. An escalated
 * Expedion job is owned by a system account nobody signs into, so there is
 * no shipper to do the picking — an operator awards in the client's place.
 * Without this branch every escalated job would be unawardable.
 */
async function assertMayAward(
  actorUserId: string,
  listing: Pick<Listing, "shipperId" | "origin">
) {
  if (listing.shipperId === actorUserId) return;
  if (listing.origin !== "expedion") throw err("FORBIDDEN_NOT_SHIPPER", 403);

  const [isOperator, isAdmin] = await Promise.all([
    userHasRole(actorUserId, "operator"),
    userHasRole(actorUserId, "admin"),
  ]);
  if (!isOperator && !isAdmin) throw err("FORBIDDEN_NOT_OPERATOR", 403);
}

/**
 * A listing can be posted and bid on with no map pin (a manually-typed
 * address); a shipment cannot, because `shipments.pickupLat/pickupLng` stay
 * NOT NULL — a driver needs a real point to navigate to.
 */
type Pins = Pick<Listing, "pickupLat" | "pickupLng" | "dropoffLat" | "dropoffLng">;

function hasBothPins<T extends Pins>(
  listing: T
): listing is T & { [K in keyof Pins]: number } {
  return (
    listing.pickupLat !== null &&
    listing.pickupLng !== null &&
    listing.dropoffLat !== null &&
    listing.dropoffLng !== null
  );
}

/**
 * The award's own checks, run before a card is touched
 * (pay_at_accept_spec.md §4). Nothing here is the concurrency guarantee —
 * `commitAward` re-checks inside its lock — it only keeps a card from being
 * authorised for an award that lock is certain to refuse.
 */
async function loadAwardable(
  actorUserId: string,
  offerId: string,
  slotId?: string
) {
  const offer = await offersDal.getById(offerId);
  if (!offer) throw err("OFFER_NOT_FOUND", 404);
  bookedSlot(offer, slotId);

  const listing = await listingsDal.getById(offer.listingId);
  if (!listing) throw err("LISTING_NOT_FOUND", 404);
  await assertMayAward(actorUserId, listing);

  if (offer.status !== "pending") throw err("OFFER_NOT_PENDING", 409);
  if (listing.status !== "open" || listing.acceptedOfferId) {
    throw err("LISTING_NOT_OPEN", 409);
  }
  // No pin? Look the addresses up and keep the result, rather than refuse the
  // requester's payment (client_feedback_2026_10_29_spec.md §P1). Refused
  // only when not even the town can be placed.
  const pinned = await listingPinsService.ensurePins(listing);
  if (!hasBothPins(pinned)) throw err("COORDINATES_REQUIRED", 422);

  const carrier = await carriersDal.getByUserId(offer.carrierId);
  if (!carrier || carrier.status !== "approved") {
    throw err("CARRIER_NO_LONGER_APPROVED", 409);
  }
  if (!mayTakeWork(carrier)) throw err("CARRIER_ABSENT", 409);

  return { offer, listing: pinned };
}

/**
 * Hands back an authorisation an accept is not going to capture, so the
 * requester's bank releases the hold now (pay_at_accept_spec.md §3.4).
 *
 * Not when this offer is already the listing's accepted one: that is the
 * requester's own double-submit losing the race to its first request, which
 * is capturing this very intent.
 */
async function releaseUnusedIntent(
  paymentIntentId: string | undefined,
  award: { offerId: string; listingId: string; shipperId: string }
) {
  if (!paymentIntentId) return;

  const fresh = await listingsDal.getById(award.listingId).catch(() => null);
  if (fresh?.acceptedOfferId === award.offerId) return;

  await paymentsService.releaseAcceptIntent(paymentIntentId, award);
}

/**
 * Hands back a second card authorised for an award that already happened
 * (pay_at_accept_spec.md §3.4). The requester's first accept went through but
 * its answer never reached them, so they paid again: this intent was never
 * captured, and its hold would sit on their statement for a week.
 *
 * Only once the award's payment is on record under a *different* intent. With
 * no row yet, or the same id, this may be a double-submit whose first request
 * is still capturing this very intent, and cancelling it would fail that
 * capture.
 */
async function releaseSupersededIntent(
  paymentIntentId: string | undefined,
  shipmentId: string | undefined,
  award: { offerId: string; listingId: string; shipperId: string }
) {
  if (!paymentIntentId || !shipmentId) return;

  const payment = await paymentsService
    .getForShipment(shipmentId)
    .catch(() => undefined);
  const paidWith = payment?.stripePaymentIntentId;
  if (!paidWith || paidWith === paymentIntentId) return;

  await paymentsService.releaseAcceptIntent(paymentIntentId, award);
}

// ========================================
// Service
// ========================================

export const offersService = {
  /**
   * Submit a bid on a transport job.
   * Undercutting is not required - a carrier may bid above the budget or above
   * a rival. The shipper decides; the service does not police the price.
   */
  async submitOffer(
    carrierUserId: string,
    listingId: string,
    data: CreateOfferInput
  ) {
    const carrier = await requireApprovedCarrier(carrierUserId);

    const listing = await listingsDal.getById(listingId);
    assertListingOpen(listing);

    if (listing.shipperId === carrierUserId) {
      throw err("CANNOT_BID_OWN_LISTING", 403);
    }

    const vehicle = await carriersDal.getVehicleById(data.vehicleId);
    if (!vehicle || vehicle.carrierId !== carrier.id) {
      throw err("VEHICLE_NOT_OWNED", 403);
    }

    assertVehicleFitsJob(listing, vehicle);

    const schedule = resolveSchedule(data, listing);

    const existing = await offersDal.getLiveByCarrierAndListing(
      listingId,
      carrierUserId
    );
    if (existing) throw err("OFFER_ALREADY_EXISTS", 409);

    const offer = await db.transaction(async (tx) => {
      const created = await offersDal.create(
        {
          id: nanoid(),
          listingId,
          carrierId: carrierUserId,
          vehicleId: data.vehicleId,
          priceCents: data.priceCents,
          estimatedPickup: schedule.estimatedPickup,
          estimatedDelivery: schedule.estimatedDelivery,
          deliveryLeadDays: data.deliveryLeadDays,
          message: data.message ?? null,
          status: "pending",
        },
        tx
      );
      await offersDal.createSlots(
        schedule.slots.map((slot) => ({ id: nanoid(), offerId: created.id, ...slot })),
        tx
      );
      await offersDal.incrementListingOffersCount(listingId, 1, tx);
      return created;
    });

    await notificationsService
      .createNotification({
        userId: listing.shipperId,
        type: "offer_received",
        title: "New offer received",
        message: `A carrier bid ${(data.priceCents / 100).toFixed(2)} € on "${listing.title}"`,
        linkUrl: `/listing/${listingId}`,
        data: { listingId, offerId: offer.id },
      })
      .catch((e) => console.error("offer_received notification failed", e));

    return offer;
  },

  /**
   * An approved carrier takes an open job outright, instead of bidding and
   * waiting to be picked.
   *
   * Composed from `submitOffer` + `acceptOffer` rather than written as its own
   * path, exactly the way `expedionEscalationService.assignDirect` already
   * composes the same two calls. That is not tidiness — it is the whole
   * concurrency argument. The guarantee that two drivers cannot both take one
   * job lives in `commitAward`'s `SELECT … FOR UPDATE` on the listing plus the
   * re-check inside that lock. Reusing `acceptOffer` inherits it verbatim: both
   * drivers mint an offer, both reach `commitAward`, and the second blocks on
   * the row and is refused. Fusing the insert and the award into one new
   * transaction would mean threading `tx` through the payments service and
   * forking the money path, which is the mistake `assignDirect` records having
   * already made and reverted.
   *
   * The price is the listing's budget. There is no negotiation on this lane —
   * the driver is accepting the job as posted, not bidding under it.
   *
   * **Escalated jobs only** (take_job_spec.md). An escalated job has nobody
   * of its own to choose: an operator awards in the client's place, and the
   * client already paid in Expedion. A direct request has its requester, who
   * chooses the offer and pays for it in the accept dialog
   * (pay_at_accept_spec.md); a take would make that choice for them and
   * charge their saved card with nobody at the keyboard.
   */
  async takeJob(
    carrierUserId: string,
    listingId: string,
    data: { vehicleId: string; message?: string }
  ) {
    const listing = await listingsDal.getById(listingId);
    assertListingOpen(listing);

    // Before `submitOffer`, so a refused take leaves no bid behind. A 409
    // rather than a 403: the carrier may still bid on this job, just not by
    // this lane. `!== "expedion"` rather than `=== "direct"`, so an origin
    // nobody anticipated is refused rather than let through.
    if (listing.origin !== "expedion") throw err("TAKE_NOT_AVAILABLE", 409);

    const offer = await this.submitOffer(carrierUserId, listingId, {
      vehicleId: data.vehicleId,
      priceCents: listing.budgetCents,
      // Nothing is proposed on this lane, so the job keeps its own window.
      slots: [],
      deliveryLeadDays: 0,
      tzOffset: 0,
      message: data.message,
    });

    // Marked before the award so the flag is already on the row every later
    // reader sees — the award queue, the KPIs, and the admin's view of who
    // decided this. Failing to mark it must not fail the award, so this is
    // best-effort: a job taken and unmarked is recoverable, a job refused
    // because a boolean would not write is not.
    await offersDal
      .markSelfAccepted(offer.id)
      .catch((e) => console.error("[offers] self-accept mark failed", e));

    const award = await this.acceptOffer(carrierUserId, offer.id, {
      selfAward: true,
    });

    // The route hands this to the carrier who took the job, so it is the award
    // view: their own offer and the shipment's id, never the rivals' bids the
    // award just rejected.
    return toAwardView({
      ...award,
      offer: { ...award.offer, selfAccepted: true },
    });
  },

  /** Withdraw a live bid. The carrier may then submit one replacement. */
  async withdrawOffer(carrierUserId: string, offerId: string) {
    const offer = await offersDal.getById(offerId);
    if (!offer) throw err("OFFER_NOT_FOUND", 404);
    if (offer.carrierId !== carrierUserId) throw err("FORBIDDEN", 403);
    if (offer.status !== "pending") throw err("OFFER_NOT_PENDING", 409);

    return await db.transaction(async (tx) => {
      const updated = await offersDal.updateStatus(offerId, "withdrawn", tx);
      await offersDal.incrementListingOffersCount(offer.listingId, -1, tx);
      return updated;
    });
  },

  // ---- Expeditoo's pick and the negotiation (client_feedback_2026_10_29_spec.md §B1, §B6) ----

  /**
   * An operator recommends one offer on a direct request. The requester still
   * pays to confirm it — in the same dialog as any other accept — so nothing
   * is awarded here and no card is touched. One pick per job: choosing
   * another replaces it.
   */
  async proposeOffer(actor: { userId: string; isAdmin?: boolean; isOperator?: boolean }, offerId: string) {
    if (!actor.isAdmin && !actor.isOperator) throw err("FORBIDDEN_NOT_OPERATOR", 403);
    const { offer, listing } = await loadNegotiable(offerId);
    if (listing.origin !== "direct") throw err("PROPOSAL_NOT_AVAILABLE", 409);

    const carrier = await carriersDal.getByUserId(offer.carrierId);
    if (!mayTakeWork(carrier)) throw err("CARRIER_ABSENT", 409);

    const proposed = await db.transaction(async (tx) => {
      await offersDal.clearProposalsForListing(listing.id, tx);
      return await offersDal.updateNegotiation(
        offerId,
        { proposedAt: new Date(), proposedBy: actor.userId },
        tx
      );
    });
    if (!proposed) throw err("OFFER_NOT_PENDING", 409);

    await notify(listing.shipperId, "offer_proposed", {
      title: "Expeditoo recommends a transporter",
      message: `We picked an offer of ${euroLabel(offer.priceCents)} for "${listing.title}". Pay to confirm it.`,
      listingId: listing.id,
      offerId,
    });
    return withoutProposer(proposed);
  },

  /** Takes Expeditoo's pick back off an offer. */
  async withdrawProposal(actor: { userId: string; isAdmin?: boolean; isOperator?: boolean }, offerId: string) {
    if (!actor.isAdmin && !actor.isOperator) throw err("FORBIDDEN_NOT_OPERATOR", 403);
    const updated = await offersDal.updateNegotiation(offerId, {
      proposedAt: null,
      proposedBy: null,
    });
    if (!updated) throw err("OFFER_NOT_PENDING", 409);
    return withoutProposer(updated);
  },

  /**
   * The requester sends a price back to one carrier. Direct requests only —
   * an escalated job's price was paid in Expedion. One counter-price pending
   * at a time per offer, at most MAX_COUNTER_ROUNDS in all.
   */
  async counterOffer(actorUserId: string, offerId: string, input: CounterOfferInput) {
    const { offer, listing } = await loadNegotiable(offerId);
    if (listing.shipperId !== actorUserId) throw err("FORBIDDEN_NOT_SHIPPER", 403);
    if (listing.origin !== "direct") throw err("COUNTER_NOT_AVAILABLE", 409);
    if (offer.counterPriceCents !== null) throw err("COUNTER_PENDING", 409);
    if (offer.counterRounds >= MAX_COUNTER_ROUNDS) throw err("COUNTER_LIMIT_REACHED", 409);
    if (input.priceCents === offer.priceCents) throw err("COUNTER_SAME_PRICE", 422);

    const updated = await offersDal.updateNegotiation(offerId, {
      counterPriceCents: input.priceCents,
      counterNote: input.note,
      counteredAt: new Date(),
      counterRounds: offer.counterRounds + 1,
    });
    if (!updated) throw err("OFFER_NOT_PENDING", 409);

    await notify(offer.carrierId, "offer_countered", {
      title: "The client sent you a price",
      message: `${euroLabel(input.priceCents)} instead of ${euroLabel(offer.priceCents)} for "${listing.title}".`,
      listingId: listing.id,
      offerId,
    });
    return withoutProposer(updated);
  },

  /**
   * The carrier answers a counter-price: take it (the offer's price becomes
   * it), refuse it, or answer with a price of their own. Every answer clears
   * the counter-price, and the requester then accepts — and pays — whatever
   * the offer's price is at that moment.
   */
  async respondToCounter(
    actorUserId: string,
    offerId: string,
    input: CounterResponseInput
  ) {
    const { offer, listing } = await loadNegotiable(offerId);
    if (offer.carrierId !== actorUserId) throw err("FORBIDDEN", 403);
    if (offer.counterPriceCents === null) throw err("NO_COUNTER_PENDING", 409);

    const carrier = await carriersDal.getByUserId(actorUserId);
    if (!mayTakeWork(carrier)) throw err("CARRIER_ABSENT", 403);

    const priceCents =
      input.action === "accept"
        ? offer.counterPriceCents
        : input.action === "revise"
          ? input.priceCents
          : offer.priceCents;

    const updated = await offersDal.updateNegotiation(offerId, {
      priceCents,
      counterPriceCents: null,
      counterNote: null,
      counteredAt: null,
    });
    if (!updated) throw err("OFFER_NOT_PENDING", 409);

    const said = {
      accept: `accepted your price of ${euroLabel(priceCents)}`,
      decline: `kept their price of ${euroLabel(priceCents)}`,
      revise: `now offers ${euroLabel(priceCents)}`,
    }[input.action];
    await notify(listing.shipperId, "offer_counter_answered", {
      title: "The transporter answered your price",
      message: `The transporter ${said} for "${listing.title}".`,
      listingId: listing.id,
      offerId,
    });
    return withoutProposer(updated);
  },

  /**
   * Someone picks a winner. This is the money path: it commits the award,
   * the shipment and the payment row atomically, then authorises Stripe
   * outside the transaction and compensates if that fails.
   *
   * Idempotent: re-accepting an already-accepted offer returns the existing
   * shipment rather than creating a second one.
   */
  async acceptOffer(
    actorUserId: string,
    offerId: string,
    opts: { selfAward?: boolean; slotId?: string; paymentIntentId?: string } = {}
  ) {
    const existing = await offersDal.getById(offerId);
    if (!existing) throw err("OFFER_NOT_FOUND", 404);

    const booked = bookedSlot(existing, opts.slotId);

    const listing = await listingsDal.getById(existing.listingId);
    if (!listing) throw err("LISTING_NOT_FOUND", 404);

    // A carrier taking their own offer. Passed explicitly by `takeJob` rather
    // than inferred from `actorUserId === existing.carrierId`, because this
    // branch is the difference between "a driver took an open job" and "anyone
    // who can create an offer can award it to themselves". The caller has to
    // say so, and only `takeJob` does.
    //
    // And only on an escalated job (take_job_spec.md §3). `takeJob` refuses a
    // direct one before any bid exists; this is the second line, so a flag
    // that reaches here on a direct job falls through to the requester's own
    // gate and is refused FORBIDDEN_NOT_SHIPPER.
    const isSelfAward =
      opts.selfAward === true &&
      existing.carrierId === actorUserId &&
      listing.origin === "expedion";

    if (!isSelfAward) await assertMayAward(actorUserId, listing);

    // A request posted without map pins gets them from its addresses before
    // the lock — the lookup is an HTTP call — so `commitAward`'s re-check
    // finds them (client_feedback_2026_10_29_spec.md §P1).
    await listingPinsService.ensurePins(listing);

    // Past the permission check, so a card this actor authorised for this
    // award is theirs to have released if the award does not use it.
    const award = {
      offerId,
      listingId: listing.id,
      shipperId: listing.shipperId,
    };

    // Idempotency: this offer already won, so return what that produced.
    if (existing.status === "accepted") {
      const shipment = await listingsDal.getShipmentByOfferId(offerId);
      await releaseSupersededIntent(opts.paymentIntentId, shipment?.id, award);
      return { offer: existing, shipment, alreadyAccepted: true };
    }

    const release = () => releaseUnusedIntent(opts.paymentIntentId, award);

    let result: Awaited<ReturnType<typeof this.commitAward>>;
    try {
      if (existing.status !== "pending") throw err("OFFER_NOT_PENDING", 409);

      // A carrier suspended after bidding must not be awarded work.
      const carrier = await carriersDal.getByUserId(existing.carrierId);
      if (!carrier || carrier.status !== "approved") {
        throw err("CARRIER_NO_LONGER_APPROVED", 409);
      }
      // Nor one who has since said they are away (§REQ-02).
      if (!mayTakeWork(carrier)) throw err("CARRIER_ABSENT", 409);

      result = await this.commitAward(offerId, listing.id, booked);
    } catch (cause) {
      await release();
      throw cause;
    }

    // Stripe is called after the commit, never inside it: an HTTP call holding
    // a row lock open would block every other accept on this listing.
    //
    // This is the booking, so this is when the client pays
    // (docs/specs/payment_at_booking_spec.md). Delivery no longer touches their
    // card; it only settles what the driver is owed.
    let payment;
    try {
      payment = await paymentsService.chargeForShipment({
        // The listing's shipper, not whoever clicked. When an operator awards
        // an escalated job the two differ, and the payment belongs to the
        // account that owns the job — never to the operator.
        shipperId: listing.shipperId,
        shipmentId: result.shipment.id,
        listingId: listing.id,
        amountCents: existing.priceCents,
        stripeCustomerId: listing.shipper?.stripeCustomerId ?? null,
        // An escalated job's client already paid, in Expedion, when they
        // accepted the quote. Charging the system account that owns the
        // listing would be a second debit against a party that never had a
        // card — the payment is recorded, not taken.
        source: listing.origin === "expedion" ? "expedion" : "stripe",
        // The card the requester authorised in the payment dialog, captured
        // rather than a saved card charged (pay_at_accept_spec.md §3.3).
        offerId,
        paymentIntentId: opts.paymentIntentId,
      });
    } catch (cause) {
      // The award is undone so the job returns to the marketplace with every
      // bid intact, rather than sitting awarded but unpaid.
      await this.compensateFailedAward(
        listing.id,
        offerId,
        result.rejectedOffers.map((o) => o.id)
      );
      await release();
      throw cause;
    }

    // A job that arrived from Expedion has a buyer waiting in that app to see
    // which carrier won. No-op for `direct` listings, and never allowed to
    // fail the award it is reporting on.
    notifyExpedion(
      expedionBridgeService.onOfferAccepted({
        listingId: listing.id,
        carrierId: existing.carrierId,
        priceCents: existing.priceCents,
      })
    );

    await notifyAwardOutcome(existing, result.rejectedOffers, listing.title);

    return { ...result, payment, alreadyAccepted: false };
  },

  /**
   * `POST /api/offers/:id/accept`: `acceptOffer`, answered as `toAwardView` —
   * fresh and idempotent alike. The internal callers (`assignDirect`, the
   * thread-offer bubble, the seed) call `acceptOffer` and keep the shipment it
   * created; nothing that reaches a browser should.
   *
   * No `selfAward` here: only `takeJob` may say that, and it is not this lane.
   */
  async acceptOfferForCaller(
    actorUserId: string,
    offerId: string,
    opts: { slotId?: string; paymentIntentId?: string } = {}
  ) {
    return toAwardView(await this.acceptOffer(actorUserId, offerId, opts));
  },

  /**
   * What accepting this offer would debit, for the payment dialog to show
   * before anything is authorised (pay_at_accept_spec.md §3.1). Read-only.
   */
  async paymentQuote(actorUserId: string, offerId: string, slotId?: string) {
    const { offer, listing } = await loadAwardable(actorUserId, offerId, slotId);

    // The client paid in Expedion when they accepted the quote, so the
    // operator awarding in their place is shown the bid and nothing to pay.
    if (listing.origin === "expedion") {
      return {
        required: false,
        reason: "prepaid" as const,
        priceCents: offer.priceCents,
        platformFeeCents: 0,
        totalCents: offer.priceCents,
        savedCard: null,
      };
    }

    return await paymentsService.quoteCharge({
      amountCents: offer.priceCents,
      stripeCustomerId: listing.shipper?.stripeCustomerId ?? null,
    });
  },

  /**
   * Authorises the requester's card for this award, before `acceptOffer`
   * captures it (pay_at_accept_spec.md §3.2). Only a direct job is paid here.
   */
  async preparePayment(
    actorUserId: string,
    offerId: string,
    input: PreparePaymentInput
  ) {
    const { offer, listing } = await loadAwardable(
      actorUserId,
      offerId,
      input.slotId
    );
    if (listing.origin === "expedion") throw err("PAYMENT_NOT_REQUIRED", 409);

    return await paymentsService.authoriseForAccept({
      shipperId: listing.shipperId,
      offerId: offer.id,
      listingId: listing.id,
      amountCents: offer.priceCents,
      // Resolved only once a charge is certain to be attempted, so a refused
      // call never leaves a Stripe customer behind.
      resolveCustomer: () => stripeService.getOrCreateCustomer(listing.shipperId),
      method: input.method,
      saveCard: input.saveCard,
    });
  },

  /**
   * The atomic core of acceptance. The listing row is locked and re-checked
   * inside the lock, which is what stops two concurrent accepts from both
   * winning the job.
   *
   * `booked` is the slot the acceptor chose. Writing it onto the offer here,
   * rather than recording it on a column of its own, is what makes the booked
   * slot the answer everywhere: the offer card, the carrier's offer list, the
   * shipment and the Expedion write-back all already read that pair. The
   * `offer_slots` rows stay, so what was proposed remains legible beside what
   * was booked (offer_time_slots_spec.md §4).
   */
  async commitAward(
    offerId: string,
    listingId: string,
    booked?: { startsAt: Date; deliveryAt: Date }
  ) {
    return await db.transaction(async (tx) => {
      const locked = await listingsDal.getByIdForUpdate(listingId, tx);
      if (!locked) throw err("LISTING_NOT_FOUND", 404);
      if (locked.status !== "open") throw err("LISTING_NOT_OPEN", 409);
      if (locked.acceptedOfferId) throw err("LISTING_ALREADY_AWARDED", 409);
      // Refused with a clear, typed error rather than letting the shipment
      // insert below hit a Postgres constraint violation inside the
      // transaction (see `hasBothPins`).
      if (!hasBothPins(locked)) throw err("COORDINATES_REQUIRED", 422);

      const offer = await offersDal.getByIdForUpdate(offerId, tx);
      if (!offer || offer.status !== "pending") {
        throw err("OFFER_NOT_PENDING", 409);
      }

      const scheduled = booked
        ? await offersDal.updateSchedule(
            offerId,
            {
              estimatedPickup: booked.startsAt,
              estimatedDelivery: booked.deliveryAt,
            },
            tx
          )
        : offer;

      // The row as written, not as read: it carries both the booked slot and
      // the accepted status, so the response cannot contradict the database or
      // the shipment shipping beside it.
      const accepted = await offersDal.updateStatus(offerId, "accepted", tx);

      const rejected = await offersDal.setPendingStatusForListing(
        listingId,
        "rejected",
        tx,
        offerId
      );

      const shipment = await listingsDal.createShipment(
        {
          id: nanoid(),
          listingId,
          offerId,
          shipperId: locked.shipperId,
          carrierId: offer.carrierId,
          status: "PENDING",
          pickupLat: locked.pickupLat,
          pickupLng: locked.pickupLng,
          pickupAddress: locked.pickupAddress,
          pickupNote: locked.pickupNote,
          pickupContactName: locked.pickupContactName,
          pickupContactPhone: locked.pickupContactPhone,
          dropoffLat: locked.dropoffLat,
          dropoffLng: locked.dropoffLng,
          dropoffAddress: locked.dropoffAddress,
          dropoffNote: locked.dropoffNote,
          dropoffContactName: locked.dropoffContactName,
          dropoffContactPhone: locked.dropoffContactPhone,
          priceCents: offer.priceCents,
          scheduledPickup: scheduled.estimatedPickup,
          scheduledDelivery: scheduled.estimatedDelivery,
        },
        tx
      );

      await listingsDal.update(
        listingId,
        { status: "awarded", acceptedOfferId: offerId },
        tx
      );

      return { offer: accepted, shipment, rejectedOffers: rejected };
    });
  },

  /**
   * Puts an awarded job back on the board with its bids intact.
   *
   * Two callers, one mechanic: the charge failed and the award never really
   * happened, or a transporter withdrew and somebody else should take this.
   * They differ only in what becomes of the winning bid and whether the job is
   * marked as having been round once (cancellations_spec.md §4.3).
   *
   * **Re-arming the window is not optional.** `findExpired` selects exactly
   * `{status:'open', expires_at < now}` and the sweep runs every fifteen
   * minutes, while `expires_at` is `pickup_from − 6 h` and is therefore already
   * past by the time anything is awarded. A listing handed back to `open`
   * untouched is invisible on the board, unbiddable, and expired by the cron —
   * along with every bid just restored — inside a quarter of an hour.
   */
  async reopenForRebid(
    listingId: string,
    offerId: string,
    rejectedOfferIds: string[],
    opts: { winnerStatus: "pending" | "withdrawn"; markReopened: boolean }
  ) {
    await db.transaction(async (tx) => {
      // The same lock `commitAward` takes. Its three in-lock re-checks are the
      // entire concurrency guarantee, and a re-board that skips the lock can
      // interleave with an accept that is mid-flight.
      const listing = await listingsDal.getByIdForUpdate(listingId, tx);
      if (!listing) throw err("LISTING_NOT_FOUND", 404);

      await offersDal.updateStatus(offerId, opts.winnerStatus, tx);
      for (const id of rejectedOfferIds) {
        await offersDal.updateStatus(id, "pending", tx);
      }

      // A bid that lands on `withdrawn` is no longer live, and `offers_count`
      // is the only signal the award queue has that there is anything to decide
      // — `withdrawOffer` decrements on exactly this status change, so skipping
      // it here would leave every re-boarded job advertising a bid that is not
      // there.
      if (opts.winnerStatus === "withdrawn") {
        await offersDal.incrementListingOffersCount(listingId, -1, tx);
      }

      await listingsDal.update(
        listingId,
        {
          status: "open",
          acceptedOfferId: null,
          ...reopenedWindow(listing, opts.markReopened),
        },
        tx
      );
    });
  },

  /**
   * Undoes an award when the charge fails (offers_engine_spec.md §5.8).
   *
   * The winner goes back to `pending` rather than `withdrawn`: nobody walked
   * away, a card was declined, and the same carrier is still the best bid on
   * the job.
   */
  async compensateFailedAward(
    listingId: string,
    offerId: string,
    rejectedOfferIds: string[]
  ) {
    await this.reopenForRebid(listingId, offerId, rejectedOfferIds, {
      winnerStatus: "pending",
      markReopened: false,
    });
    console.error(
      `Award compensated for listing ${listingId}; payment failed`
    );
  },

  /**
   * Visibility differs by viewer: the shipper sees every bid, a carrier sees
   * only their own, and everyone else sees aggregates
   * (offers_engine_spec.md §6).
   */
  async getOffersForViewer(
    listingId: string,
    viewerId: string | null,
    opts: { sort?: string; isStaff?: boolean } = {}
  ) {
    const listing = await listingsDal.getById(listingId);
    if (!listing) throw err("LISTING_NOT_FOUND", 404);

    const isShipper = viewerId !== null && listing.shipperId === viewerId;

    if (isShipper || opts.isStaff) {
      const all = await offersDal.listByListing(listingId, opts.sort);
      return {
        scope: "full" as const,
        offers: sortOffers(all, opts.sort).map(asSeenByRequester),
      };
    }

    if (viewerId) {
      const own = await offersDal.getLiveByCarrierAndListing(
        listingId,
        viewerId
      );
      if (own) {
        const detailed = await offersDal.getById(own.id);
        return {
          scope: "own" as const,
          offers: detailed ? [withoutProposer(detailed)] : [],
        };
      }
    }

    const aggregate = await offersDal.getAggregate(listingId);
    return { scope: "aggregate" as const, ...aggregate };
  },

  /**
   * A carrier's own bids. The job inside each is the approved carrier's view
   * of it — the contacts and the access notes come with the shipment, if they
   * win (listing_privacy_spec.md §3).
   */
  async getCarrierOffers(
    carrierUserId: string,
    filters: { status?: Offer["status"]; page: number; limit: number }
  ) {
    const rows = await offersDal.listByCarrier(carrierUserId, filters);
    return rows.map((offer) =>
      withoutProposer({
        ...offer,
        listing: offer.listing ? toListingView(offer.listing, "vetted") : offer.listing,
      })
    );
  },

  /** Called by the expiry cron and by material edits to a listing. */
  async expirePendingOffers(listingId: string) {
    return await offersDal.setPendingStatusForListing(listingId, "expired");
  },
};

/**
 * What a re-boarded listing's dates become.
 *
 * The two callers are not the same event. A transporter withdrew and the job
 * genuinely goes round again, so its window may be slid forward and is stamped
 * as having moved. A card was declined seconds ago and nobody went anywhere —
 * that job gets its bidding deadline repaired and its **own dates left alone**,
 * because moving a client's collection date on the strength of a payment
 * failure, with no marker and nobody told, is the one state `reopened_at`
 * exists to make impossible.
 */
function reopenedWindow(
  listing: Listing,
  markReopened: boolean
): Partial<InsertListing> {
  // A flexible direct request takes offers until its window ends, on its
  // second round as on its first (client_feedback_2026_10_spec.md §4).
  const runsUntil = biddingRunsUntil(listing, listing.origin === "direct");
  if (markReopened) {
    const now = new Date();
    return { ...rearmedWindow(listing, now, runsUntil !== null), reopenedAt: now };
  }

  const expiresAt = rearmedExpiry(listing.pickupFrom, new Date(), runsUntil);
  return expiresAt ? { expiresAt } : {};
}

/** Rating lives on the joined carrier, so that sort is applied in memory. */
function sortOffers<T extends { carrier?: { rating?: number } }>(
  rows: T[],
  sort?: string
): T[] {
  if (sort !== "rating_desc") return rows;
  return [...rows].sort(
    (a, b) => (b.carrier?.rating ?? 0) - (a.carrier?.rating ?? 0)
  );
}

/**
 * Tells the winner they won and every other bidder that they did not. Losing
 * silently is the worst outcome for a carrier who is holding capacity open.
 */
async function notifyAwardOutcome(
  winner: { carrierId: string; listingId: string },
  rejected: { carrierId: string }[],
  jobTitle: string
) {
  await Promise.all([
    notificationsService
      .createNotification({
        userId: winner.carrierId,
        type: "offer_accepted",
        title: "Your offer was accepted",
        message: `You won the job "${jobTitle}".`,
        linkUrl: `/listing/${winner.listingId}`,
        data: { listingId: winner.listingId },
      })
      .catch((e) => console.error("offer_accepted notification failed", e)),

    // And an email and a text (client_feedback_2026_10_29_spec.md §N7).
    driverAlertsService
      .onOfferAccepted({
        carrierUserId: winner.carrierId,
        jobTitle,
        listingId: winner.listingId,
      })
      .catch((e) => console.error("offer_accepted alert failed", e)),

    ...rejected.map((offer) =>
      notificationsService
        .createNotification({
          userId: offer.carrierId,
          type: "offer_rejected",
          title: "Another carrier was selected",
          message: `The shipper chose a different offer for "${jobTitle}".`,
          linkUrl: `/listing/${winner.listingId}`,
          data: { listingId: winner.listingId },
        })
        .catch((e) => console.error("offer_rejected notification failed", e))
    ),
  ]);
}
