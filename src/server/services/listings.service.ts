import { nanoid } from "nanoid";
import { listingsDal, type BrowseFilters } from "@/server/dal/listings.dal";
import { offersService } from "@/server/services/offers.service";
import { notificationsService } from "@/server/services/notifications.service";
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

/** Bidding closes 6 h before pickup, unless the job is posted later than that. */
const BIDDING_LEAD_MS = 6 * 60 * 60 * 1000;
const MIN_BIDDING_WINDOW_MS = 30 * 60 * 1000;

/**
 * A job posted well ahead closes to bids 6 h before pickup. One posted at
 * short notice still gets a 30-minute window; below that there is no time to
 * bid at all, so the job is rejected rather than published dead.
 */
export function resolveExpiresAt(pickupFrom: Date, now = new Date()): Date {
  const preferred = new Date(pickupFrom.getTime() - BIDDING_LEAD_MS);
  if (preferred > now) return preferred;

  const clamped = new Date(now.getTime() + MIN_BIDDING_WINDOW_MS);
  if (clamped > pickupFrom) throw err("PICKUP_TOO_SOON", 400);
  return clamped;
}

function toInsert(
  shipperId: string,
  data: CreateListingInput,
  expiresAt: Date
): InsertListing {
  return {
    id: nanoid(),
    shipperId,
    categoryId: data.categoryId,
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
  async createListing(shipperId: string, data: CreateListingInput) {
    // A draft may sit unposted, so the pickup window is only enforced when the
    // job actually goes live.
    if (data.publish && data.pickupFrom <= new Date()) {
      throw err("PICKUP_IN_PAST", 400);
    }

    const expiresAt = resolveExpiresAt(data.pickupFrom);
    const listing = await listingsDal.create(toInsert(shipperId, data, expiresAt));

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
    if (listing.status === "in_progress" && !isAdmin) {
      throw err("CANCEL_REQUIRES_SUPPORT", 409);
    }

    if (listing.status === "draft") {
      await listingsDal.delete(listingId);
      return { deleted: true };
    }

    // Releasing the Stripe authorisation for an awarded job is WP6; the
    // listing and its offers are settled here.
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

  async getMyListings(shipperId: string, status?: Listing["status"]) {
    return await listingsDal.getByShipperId(shipperId, status);
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
