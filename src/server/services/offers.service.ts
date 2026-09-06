import { nanoid } from "nanoid";
import { db } from "@/db";
import { offersDal } from "@/server/dal/offers.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { userHasRole } from "@/server/dal/users.dal";
import { notificationsService } from "@/server/services/notifications.service";
import { paymentsService } from "@/server/services/payments.service";
import {
  expedionBridgeService,
  notifyExpedion,
} from "@/server/services/expedion-bridge.service";
import {
  overlapsWindow,
  resolveOfferSlots,
  type ResolvedOfferSlot,
} from "@/lib/offer-slots";
import { rearmedExpiry, rearmedWindow } from "@/lib/listing-window";
import type { CreateOfferInput } from "@/server/dto/offers.dto";
import type { InsertListing, Listing } from "@/db/schema/listings";
import type { Offer } from "@/db/schema/offers";
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

/** An approved carrier account is the licence to bid. */
async function requireApprovedCarrier(userId: string) {
  const carrier = await carriersDal.getByUserId(userId);
  if (!carrier) throw err("CARRIER_NOT_APPROVED", 403);
  if (carrier.status !== "approved") throw err("CARRIER_NOT_APPROVED", 403);
  return carrier;
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
   */
  async takeJob(
    carrierUserId: string,
    listingId: string,
    data: { vehicleId: string; message?: string }
  ) {
    const listing = await listingsDal.getById(listingId);
    assertListingOpen(listing);

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

    return { ...award, offer: { ...award.offer, selfAccepted: true } };
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
    opts: { selfAward?: boolean; slotId?: string } = {}
  ) {
    const existing = await offersDal.getById(offerId);
    if (!existing) throw err("OFFER_NOT_FOUND", 404);

    // Which of the carrier's proposed slots is being booked. Absent means the
    // earliest, which is already the offer's stored pair — so an offer with one
    // slot, and the lanes that propose none, need name nothing.
    const booked = opts.slotId
      ? existing.slots.find((slot) => slot.id === opts.slotId)
      : undefined;
    if (opts.slotId && !booked) throw err("SLOT_NOT_ON_OFFER", 400);

    // `SLOT_IN_PAST` is a submit-time rule (offers.dto.ts), and until bids
    // could be restored that was enough — an offer was accepted within its own
    // window or not at all. A withdrawal now puts rejected bids back in play on
    // a listing whose window may have slid forward, so the slot an operator
    // picks off the award queue can be behind us; booking it would write a past
    // `scheduled_pickup` and report a past pickup date to the client.
    if (booked && booked.startsAt <= new Date()) {
      throw err("SLOT_IN_PAST", 409);
    }

    const listing = await listingsDal.getById(existing.listingId);
    if (!listing) throw err("LISTING_NOT_FOUND", 404);

    // A carrier taking their own offer. Passed explicitly by `takeJob` rather
    // than inferred from `actorUserId === existing.carrierId`, because this
    // branch is the difference between "a driver took an open job" and "anyone
    // who can create an offer can award it to themselves". The caller has to
    // say so, and only `takeJob` does.
    const isSelfAward =
      opts.selfAward === true && existing.carrierId === actorUserId;

    // Who may award depends on where the job came from.
    //
    // A direct listing is awarded by the shipper who posted it. An escalated
    // Expedion job is owned by a system account nobody signs into, so there is
    // no shipper to do the picking — an operator awards in the client's place.
    // Without this branch every escalated job would be unawardable.
    if (!isSelfAward && listing.shipperId !== actorUserId) {
      if (listing.origin !== "expedion") {
        throw err("FORBIDDEN_NOT_SHIPPER", 403);
      }

      const [isOperator, isAdmin] = await Promise.all([
        userHasRole(actorUserId, "operator"),
        userHasRole(actorUserId, "admin"),
      ]);
      if (!isOperator && !isAdmin) {
        throw err("FORBIDDEN_NOT_OPERATOR", 403);
      }
    }

    // Idempotency: this offer already won, so return what that produced.
    if (existing.status === "accepted") {
      const shipment = await listingsDal.getShipmentByOfferId(offerId);
      return { offer: existing, shipment, alreadyAccepted: true };
    }

    if (existing.status !== "pending") throw err("OFFER_NOT_PENDING", 409);

    // A carrier suspended after bidding must not be awarded work.
    const carrier = await carriersDal.getByUserId(existing.carrierId);
    if (!carrier || carrier.status !== "approved") {
      throw err("CARRIER_NO_LONGER_APPROVED", 409);
    }

    const result = await this.commitAward(offerId, listing.id, booked);

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
      });
    } catch (cause) {
      // The award is undone so the job returns to the marketplace with every
      // bid intact, rather than sitting awarded but unpaid.
      await this.compensateFailedAward(
        listing.id,
        offerId,
        result.rejectedOffers.map((o) => o.id)
      );
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
          dropoffLat: locked.dropoffLat,
          dropoffLng: locked.dropoffLng,
          dropoffAddress: locked.dropoffAddress,
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
      return { scope: "full" as const, offers: sortOffers(all, opts.sort) };
    }

    if (viewerId) {
      const own = await offersDal.getLiveByCarrierAndListing(
        listingId,
        viewerId
      );
      if (own) {
        const detailed = await offersDal.getById(own.id);
        return { scope: "own" as const, offers: detailed ? [detailed] : [] };
      }
    }

    const aggregate = await offersDal.getAggregate(listingId);
    return { scope: "aggregate" as const, ...aggregate };
  },

  async getCarrierOffers(
    carrierUserId: string,
    filters: { status?: Offer["status"]; page: number; limit: number }
  ) {
    return await offersDal.listByCarrier(carrierUserId, filters);
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
  if (markReopened) {
    return { ...rearmedWindow(listing), reopenedAt: new Date() };
  }

  const expiresAt = rearmedExpiry(listing.pickupFrom);
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
