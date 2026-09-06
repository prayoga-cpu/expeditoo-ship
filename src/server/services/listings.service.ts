import { nanoid } from "nanoid";
import { listingsDal, type BrowseFilters } from "@/server/dal/listings.dal";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { offersService } from "@/server/services/offers.service";
import { notificationsService } from "@/server/services/notifications.service";
import { paymentsService } from "@/server/services/payments.service";
import { isMockPaymentsEnabled } from "@/lib/stripe/mock-payments";
import { expiresAtFor } from "@/lib/listing-window";
import {
  MATERIAL_FIELDS,
  type CreateListingInput,
  type UpdateListingInput,
} from "@/server/dto/listings.dto";
import type { InsertListing, Listing } from "@/db/schema/listings";

// ========================================
// Errors
// ========================================

export class ListingError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ListingError";
  }
}

const err = (code: string, status: number) => new ListingError(code, status);

/**
 * A direct job may not reach the board until its poster has a card on file.
 *
 * The client pays the moment a carrier is chosen
 * (docs/specs/payment_at_booking_spec.md §4), so a job posted without a card is
 * a job that cannot be awarded — and every carrier who bids on it spends
 * effort on work that was never payable. The check belongs here rather than at
 * the award, where the only people it could disappoint are the driver who won
 * and the operator who picked them.
 *
 * A draft is exempt: it is not on the board, nobody can bid on it, and asking
 * for a card to save one would be a toll on a form that has committed to
 * nothing.
 */
async function assertPayable(shipperId: string) {
  // TODO(EXPEDITOO-TESTING): MOCK_PAYMENTS — the charge this guards is mocked, so demanding a real card would only block the testing journey (see docs/TESTING_MOCKS.md).
  if (isMockPaymentsEnabled()) return;
  if (await paymentsService.hasSavedCard(shipperId)) return;

  throw err("PAYMENT_METHOD_REQUIRED", 402);
}

/**
 * A job posted well ahead closes to bids 6 h before pickup. One posted at
 * short notice still gets a 30-minute window; below that there is no time to
 * bid at all, so the job is rejected rather than published dead.
 *
 * The arithmetic moved to `src/lib/listing-window.ts` when re-boarding arrived:
 * `offers.service.ts` has to compute the same window and cannot import this
 * module, which imports it. This is the throwing wrapper; the lib returns null.
 */
export function resolveExpiresAt(pickupFrom: Date, now = new Date()): Date {
  const expiresAt = expiresAtFor(pickupFrom, now);
  if (!expiresAt) throw err("PICKUP_TOO_SOON", 400);
  return expiresAt;
}

function toInsert(
  shipperId: string,
  data: CreateListingInput,
  expiresAt: Date,
  categoryId: string
): InsertListing {
  return {
    id: nanoid(),
    shipperId,
    categoryId,
    // Stamped here, and deliberately not a field on `createListingSchema`.
    // `offersService.acceptOffer` reads `listing.origin` to decide whether an
    // operator may award the job in the owner's place, so a client-supplied
    // origin would let any signed-in account post work straight into the
    // operator queue. Escalation stamps `expedion` on its own listings the
    // same way, from the server side.
    origin: "direct",
    status: data.publish ? "open" : "draft",
    title: data.title,
    description: data.description,
    weightKg: data.weightKg,
    lengthCm: data.lengthCm,
    widthCm: data.widthCm,
    heightCm: data.heightCm,
    quantity: data.quantity,
    isFragile: data.isFragile,
    needsHelp: data.needsHelp,

    pickupLat: data.pickup.lat,
    pickupLng: data.pickup.lng,
    pickupAddress: data.pickup.address,
    pickupCity: data.pickup.city,
    pickupPostalCode: data.pickup.postalCode,
    pickupLocationType: data.pickup.locationType,
    pickupFloor: data.pickup.floor,
    pickupHasLift: data.pickup.hasLift,

    dropoffLat: data.dropoff.lat,
    dropoffLng: data.dropoff.lng,
    dropoffAddress: data.dropoff.address,
    dropoffCity: data.dropoff.city,
    dropoffPostalCode: data.dropoff.postalCode,
    dropoffLocationType: data.dropoff.locationType,
    dropoffFloor: data.dropoff.floor,
    dropoffHasLift: data.dropoff.hasLift,

    pickupFrom: data.pickupFrom,
    pickupUntil: data.pickupUntil,
    dropoffFrom: data.dropoffFrom,
    dropoffUntil: data.dropoffUntil,
    isFlexible: data.isFlexible,

    budgetCents: data.budgetCents,
    expiresAt,
  };
}

function assertOwner(listing: Listing | undefined, userId: string): Listing {
  if (!listing) throw err("LISTING_NOT_FOUND", 404);
  if (listing.shipperId !== userId) throw err("FORBIDDEN_NOT_OWNER", 403);
  return listing;
}

export const listingsService = {
  /**
   * @param opts.prepaid the job's client has already paid somewhere else, so
   *   no card is required here. Passed explicitly by `expedionEscalationService`
   *   and by nothing else: an escalated listing is owned by a system account
   *   that no card belongs to, and its client paid in Expedion when they
   *   accepted the quote. Inferring this from `shipperId` would make the one
   *   caller allowed to skip the check indistinguishable from a mistake.
   */
  async createListing(
    shipperId: string,
    data: CreateListingInput,
    opts: { prepaid?: boolean } = {}
  ) {
    // A draft may sit unposted, so the pickup window is only enforced when the
    // job actually goes live.
    if (data.publish && data.pickupFrom <= new Date()) {
      throw err("PICKUP_IN_PAST", 400);
    }

    if (data.publish && !opts.prepaid) await assertPayable(shipperId);

    const expiresAt = resolveExpiresAt(data.pickupFrom);
    // A requester describes an object, not a taxonomy node, so the category is
    // resolved here when the caller did not name one.
    const categoryId =
      data.categoryId ?? (await listingsDal.ensureDefaultCategory());
    const listing = await listingsDal.create(
      toInsert(shipperId, data, expiresAt, categoryId)
    );

    if (data.photos.length > 0) {
      await listingsDal.addPhotos(
        data.photos.map((url, order) => ({
          id: nanoid(),
          listingId: listing.id,
          url,
          order,
        }))
      );
    }

    return listing;
  },

  async publishListing(shipperId: string, listingId: string) {
    const listing = assertOwner(await listingsDal.getById(listingId), shipperId);
    if (listing.status !== "draft") throw err("LISTING_NOT_DRAFT", 409);
    if (listing.pickupFrom <= new Date()) throw err("PICKUP_IN_PAST", 400);
    // No exemption here: `assertOwner` has already established that a person is
    // publishing their own draft, and the system account owns no drafts.
    await assertPayable(shipperId);

    return await listingsDal.update(listingId, {
      status: "open",
      expiresAt: resolveExpiresAt(listing.pickupFrom),
    });
  },

  /**
   * Edits split by whether a carrier priced against the field. Changing what
   * was priced invalidates every live offer, so carriers are told to re-bid
   * rather than left holding a quote for a different job.
   */
  async updateListing(
    shipperId: string,
    listingId: string,
    data: UpdateListingInput
  ) {
    const listing = assertOwner(await listingsDal.getById(listingId), shipperId);

    if (["awarded", "in_progress", "completed"].includes(listing.status)) {
      throw err("LISTING_NOT_EDITABLE", 409);
    }

    const isMaterial = MATERIAL_FIELDS.some((f) => data[f] !== undefined);
    const updated = await listingsDal.update(listingId, flattenUpdate(data));

    let invalidatedOffers = 0;
    if (isMaterial && listing.offersCount > 0) {
      const expired = await offersService.expirePendingOffers(listingId);
      invalidatedOffers = expired.length;
      await listingsDal.update(listingId, { offersCount: 0 });
      await notifyOffersInvalidated(expired, listing);
    }

    return { listing: updated, invalidatedOffers };
  },

  async cancelListing(userId: string, listingId: string, isAdmin = false) {
    const listing = await listingsDal.getById(listingId);
    if (!listing) throw err("LISTING_NOT_FOUND", 404);
    if (!isAdmin && listing.shipperId !== userId) {
      throw err("FORBIDDEN_NOT_OWNER", 403);
    }

    if (listing.status === "completed") throw err("LISTING_NOT_CANCELLABLE", 409);

    /**
     * A job with a live run is not this door's to close, for **anybody**.
     *
     * This is only about a listing nobody has taken yet. Once an offer has been
     * accepted there is a shipment, a driver planning around it and — since
     * payment-at-booking — the client's money; ending it here would leave the
     * listing `cancelled` with `accepted_offer_id` still set, the shipment
     * still on the driver's screen and nothing refunded, which is the whole set
     * of guarantees `shipment-cancellation.service.ts` exists to make. The
     * refusal names the door that works rather than refusing flatly.
     *
     * `in_progress` is joined to `awarded` here although nothing in the repo
     * writes it: a dead value that would silently re-open this hole the day
     * something does is worse than a redundant branch.
     * See docs/specs/cancellations_spec.md §10.7.
     */
    if (listing.status === "awarded" || listing.status === "in_progress") {
      throw err("CANCEL_VIA_SHIPMENT", 409);
    }

    if (listing.status === "draft") {
      await listingsDal.delete(listingId);
      return { deleted: true };
    }

    // Nothing was ever charged: `chargeForShipment` runs at award, and an
    // awarded job cannot reach here.
    await offersService.expirePendingOffers(listingId);
    const cancelled = await listingsDal.update(listingId, {
      status: "cancelled",
      offersCount: 0,
    });
    return { deleted: false, listing: cancelled };
  },

  async browse(filters: BrowseFilters) {
    return await listingsDal.browse(filters);
  },

  async getListing(listingId: string, viewerId: string | null) {
    const listing = await listingsDal.getById(listingId);
    if (!listing) throw err("LISTING_NOT_FOUND", 404);

    // A draft belongs to nobody but its author.
    if (listing.status === "draft" && listing.shipperId !== viewerId) {
      throw err("LISTING_NOT_FOUND", 404);
    }

    if (viewerId !== listing.shipperId) {
      await listingsDal.incrementViews(listingId);
    }

    return listing;
  },

  /**
   * The caller's own jobs, each carrying its delivery once one happened.
   *
   * The delivery is fetched in a second batched query rather than through a
   * relation: `shipments.ts` already imports `listings.ts`, so declaring the
   * reverse would put a cycle in the schema layer, and `getByShipperId` has a
   * second caller that wants it left alone
   * (my_requests_history_spec.md §4.3).
   */
  async getMyListings(shipperId: string, status?: Listing["status"]) {
    const listings = await listingsDal.getByShipperId(shipperId, status);
    if (listings.length === 0) return [];

    const deliveries = await shipmentsDal.listDeliveredForListings(
      listings.map((listing) => listing.id)
    );

    // `shipment_listing_idx` is not unique, so a listing can in principle carry
    // more than one delivered shipment - an award revoked after delivery would
    // do it. The rows arrive newest first, and `new Map(entries)` keeps the
    // *last* of a repeated key, which would surface the oldest delivery. Keep
    // the first one seen instead.
    const byListing = new Map<string, (typeof deliveries)[number]>();
    for (const row of deliveries) {
      if (!byListing.has(row.listingId)) byListing.set(row.listingId, row);
    }

    return listings.map((listing) => ({
      ...listing,
      delivery: toDelivery(byListing.get(listing.id)),
    }));
  },

  /** Expiry cron: a job whose window closed with no carrier selected. */
  async expireDueListings(now = new Date()) {
    const due = await listingsDal.findExpired(now);

    for (const listing of due) {
      await offersService.expirePendingOffers(listing.id);
      await listingsDal.update(listing.id, { status: "expired" });
      await notificationsService
        .createNotification({
          userId: listing.shipperId,
          type: "listing_expired",
          title: "No carrier selected",
          message: `"${listing.title}" closed without an accepted offer.`,
          linkUrl: `/listing/${listing.id}`,
          data: { listingId: listing.id },
        })
        .catch((e) => console.error("listing_expired notification failed", e));
    }

    return due.length;
  },
};

type DeliveredRow = Awaited<
  ReturnType<typeof shipmentsDal.listDeliveredForListings>
>[number];

/**
 * The delivery block the requester's history is drawn from.
 *
 * Carrier fields are limited to what is already rendered to this same viewer -
 * name, avatar, rating - and the delivery photos become a boolean, because a
 * marker is all the card needs and the photos themselves are a click away on
 * the shipment (my_requests_history_spec.md §4.1).
 *
 * `carrier` is null rather than the delivery being dropped when the row does
 * not resolve: a delivery that happened is history either way.
 */
function toDelivery(row: DeliveredRow | undefined) {
  if (!row) return null;

  return {
    shipmentId: row.shipmentId,
    deliveredAt: row.deliveredAt,
    priceCents: row.priceCents,
    hasProofOfDelivery: row.hasDeliveryPhoto,
    // Both columns come from the same LEFT JOIN, so they resolve together or
    // not at all. Requiring the name too keeps the card from ever pairing
    // "account removed" with a live rating.
    carrier:
      row.carrierId && row.carrierName
        ? {
            id: row.carrierId,
            name: row.carrierName,
            image: row.carrierImage,
            rating: row.carrierRating ?? 0,
          }
        : null,
  };
}

/** Maps the nested pickup/dropoff DTO shape onto flat columns. */
function flattenUpdate(data: UpdateListingInput): Record<string, unknown> {
  const { pickup, dropoff, ...rest } = data;
  const out: Record<string, unknown> = { ...rest };

  if (pickup) {
    Object.assign(out, {
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      pickupAddress: pickup.address,
      pickupCity: pickup.city,
      pickupPostalCode: pickup.postalCode,
      pickupLocationType: pickup.locationType,
      pickupFloor: pickup.floor,
      pickupHasLift: pickup.hasLift,
    });
  }
  if (dropoff) {
    Object.assign(out, {
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
      dropoffAddress: dropoff.address,
      dropoffCity: dropoff.city,
      dropoffPostalCode: dropoff.postalCode,
      dropoffLocationType: dropoff.locationType,
      dropoffFloor: dropoff.floor,
      dropoffHasLift: dropoff.hasLift,
    });
  }
  return out;
}

async function notifyOffersInvalidated(
  expired: { carrierId: string }[],
  listing: Listing
) {
  await Promise.all(
    expired.map((offer) =>
      notificationsService
        .createNotification({
          userId: offer.carrierId,
          type: "offer_invalidated",
          title: "Job details changed",
          message: `"${listing.title}" was edited. Submit a new offer if you are still interested.`,
          linkUrl: `/listing/${listing.id}`,
          data: { listingId: listing.id },
        })
        .catch((e) => console.error("offer_invalidated notification failed", e))
    )
  );
}
