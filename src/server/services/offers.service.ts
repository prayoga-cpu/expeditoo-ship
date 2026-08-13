import { nanoid } from "nanoid";
import { db } from "@/db";
import { offersDal } from "@/server/dal/offers.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { notificationsService } from "@/server/services/notifications.service";
import {
  expedionBridgeService,
  notifyExpedion,
} from "@/server/services/expedion-bridge.service";
import type { CreateOfferInput } from "@/server/dto/offers.dto";
import type { Listing } from "@/db/schema/listings";
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

/**
 * Validates the parts of an offer that need the listing and the vehicle.
 * Purely-input rules live in the DTO.
 */
function assertOfferFitsJob(
  data: CreateOfferInput,
  listing: Listing,
  vehicle: Vehicle
): void {
  const withinWindow =
    data.estimatedPickup >= listing.pickupFrom &&
    data.estimatedPickup <= listing.pickupUntil;

  if (!listing.isFlexible && !withinWindow) {
    throw err("PICKUP_OUTSIDE_WINDOW", 400);
  }

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

    assertOfferFitsJob(data, listing, vehicle);

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
          estimatedPickup: data.estimatedPickup,
          estimatedDelivery: data.estimatedDelivery,
          message: data.message ?? null,
          status: "pending",
        },
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
   * The shipper picks a winner. This is the money path: it commits the award,
   * the shipment and the payment row atomically, then authorises Stripe
   * outside the transaction and compensates if that fails.
   *
   * Idempotent: re-accepting an already-accepted offer returns the existing
   * shipment rather than creating a second one.
   */
  async acceptOffer(shipperUserId: string, offerId: string) {
    const existing = await offersDal.getById(offerId);
    if (!existing) throw err("OFFER_NOT_FOUND", 404);

    const listing = await listingsDal.getById(existing.listingId);
    if (!listing) throw err("LISTING_NOT_FOUND", 404);
    if (listing.shipperId !== shipperUserId) {
      throw err("FORBIDDEN_NOT_SHIPPER", 403);
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

    const result = await this.commitAward(offerId, listing.id);

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

    return { ...result, alreadyAccepted: false };
  },

  /**
   * The atomic core of acceptance. The listing row is locked and re-checked
   * inside the lock, which is what stops two concurrent accepts from both
   * winning the job.
   */
  async commitAward(offerId: string, listingId: string) {
    return await db.transaction(async (tx) => {
      const locked = await listingsDal.getByIdForUpdate(listingId, tx);
      if (!locked) throw err("LISTING_NOT_FOUND", 404);
      if (locked.status !== "open") throw err("LISTING_NOT_OPEN", 409);
      if (locked.acceptedOfferId) throw err("LISTING_ALREADY_AWARDED", 409);

      const offer = await offersDal.getByIdForUpdate(offerId, tx);
      if (!offer || offer.status !== "pending") {
        throw err("OFFER_NOT_PENDING", 409);
      }

      await offersDal.updateStatus(offerId, "accepted", tx);
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
          scheduledPickup: offer.estimatedPickup,
          scheduledDelivery: offer.estimatedDelivery,
        },
        tx
      );

      await listingsDal.update(
        listingId,
        { status: "awarded", acceptedOfferId: offerId },
        tx
      );

      return { offer, shipment, rejectedOffers: rejected };
    });
  },

  /**
   * Undoes an award when payment authorisation fails, returning the job to the
   * marketplace with every bid intact (offers_engine_spec.md §5.8).
   */
  async compensateFailedAward(
    listingId: string,
    offerId: string,
    rejectedOfferIds: string[]
  ) {
    await db.transaction(async (tx) => {
      await offersDal.updateStatus(offerId, "pending", tx);
      for (const id of rejectedOfferIds) {
        await offersDal.updateStatus(id, "pending", tx);
      }
      await listingsDal.update(
        listingId,
        { status: "open", acceptedOfferId: null },
        tx
      );
    });
    console.error(
      `Award compensated for listing ${listingId}; payment authorisation failed`
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
