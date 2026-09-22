import { nanoid } from "nanoid";
import { listingsDal, type BrowseFilters } from "@/server/dal/listings.dal";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { offersService } from "@/server/services/offers.service";
import { notificationsService } from "@/server/services/notifications.service";
import { emailService } from "@/server/services/email.service";
import { isSystemAccount } from "@/server/services/account-policy";
import { getUserById } from "@/server/dal/users.dal";
import { formatCurrency } from "@/lib/currency";
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
    status: !data.publish ? "draft" : data.scheduledPublishAt ? "scheduled" : "open",
    title: data.title,
    description: data.description,
    weightKg: data.weightKg,
    lengthCm: data.lengthCm,
    widthCm: data.widthCm,
    heightCm: data.heightCm,
    quantity: data.quantity,
    isFragile: data.isFragile,
    needsHelp: data.needsHelp,
    packagingLevel: data.packagingLevel,

    pickupLat: data.pickup.lat,
    pickupLng: data.pickup.lng,
    pickupAddress: data.pickup.address,
    pickupCity: data.pickup.city,
    pickupPostalCode: data.pickup.postalCode,
    pickupLocationType: data.pickup.locationType,
    pickupFloor: data.pickup.floor,
    pickupHasLift: data.pickup.hasLift,
    pickupNote: data.pickup.note,
    pickupContactName: data.pickup.contactName,
    pickupContactPhone: data.pickup.contactPhone,

    dropoffLat: data.dropoff.lat,
    dropoffLng: data.dropoff.lng,
    dropoffAddress: data.dropoff.address,
    dropoffCity: data.dropoff.city,
    dropoffPostalCode: data.dropoff.postalCode,
    dropoffLocationType: data.dropoff.locationType,
    dropoffFloor: data.dropoff.floor,
    dropoffHasLift: data.dropoff.hasLift,
    dropoffNote: data.dropoff.note,
    dropoffContactName: data.dropoff.contactName,
    dropoffContactPhone: data.dropoff.contactPhone,

    pickupFrom: data.pickupFrom,
    pickupUntil: data.pickupUntil,
    dropoffFrom: data.dropoffFrom,
    dropoffUntil: data.dropoffUntil,
    isFlexible: data.isFlexible,

    budgetCents: data.budgetCents,
    expiresAt,
    scheduledPublishAt: data.scheduledPublishAt ?? null,
  };
}

function assertOwner(listing: Listing | undefined, userId: string): Listing {
  if (!listing) throw err("LISTING_NOT_FOUND", 404);
  if (listing.shipperId !== userId) throw err("FORBIDDEN_NOT_OWNER", 403);
  return listing;
}

export const listingsService = {
  async createListing(shipperId: string, data: CreateListingInput) {
    const now = new Date();

    // A draft may sit unposted, so the pickup window is only enforced when the
    // job actually goes live.
    if (data.publish && data.pickupFrom <= now) {
      throw err("PICKUP_IN_PAST", 400);
    }

    // A schedule is a promise to go live later; the promise itself has to be
    // in the future, or "later" is a lie.
    if (data.scheduledPublishAt && data.scheduledPublishAt <= now) {
      throw err("SCHEDULED_PUBLISH_IN_PAST", 400);
    }

    // The bidding window is measured from whichever moment the job actually
    // reaches the board: the scheduled instant for a scheduled job, `now` for
    // everything else (open or draft alike). A schedule whose own instant
    // leaves no usable window (e.g. at or after `pickupFrom`) fails here with
    // the same `PICKUP_TOO_SOON` a normal too-soon pickup already gets.
    const expiresAt = resolveExpiresAt(
      data.pickupFrom,
      data.scheduledPublishAt ?? now
    );
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

    // The system account owns every escalated listing and nobody signs into
    // it to read an email or a bell notification — `expedionEscalationService`
    // reaches this same method with that account's id
    // (listing_posted_feedback_spec.md §1). A scheduled job isn't live yet
    // either, so there is nothing to announce until the cron actually
    // publishes it.
    if (data.publish && !data.scheduledPublishAt && !isSystemAccount(shipperId)) {
      await announceListingPosted(listing, shipperId);
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

    // Not yet on the board belongs to nobody but its author: `draft` because
    // nothing has been committed to yet, `scheduled` because it has, but
    // carriers cannot act on it until `publishScheduled` flips it live.
    if (
      (listing.status === "draft" || listing.status === "scheduled") &&
      listing.shipperId !== viewerId
    ) {
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

  /**
   * Scheduled-publish cron: a job whose chosen "go live" instant has arrived.
   *
   * `expiresAt` was already anchored on `scheduledPublishAt` at creation time,
   * so the common case is a plain status flip. This still re-derives it
   * against the actual firing time rather than trusting the stored value
   * blindly — the cron that calls this can run late — so a job whose pickup
   * window closed in the meantime is expired instead of opened dead.
   */
  async publishScheduled(now = new Date()) {
    const due = await listingsDal.findDueScheduled(now);
    let published = 0;

    for (const listing of due) {
      let expiresAt: Date;
      try {
        expiresAt = resolveExpiresAt(listing.pickupFrom, now);
      } catch {
        // Never opened, so it never took an offer — nothing for
        // `expirePendingOffers` to do here, unlike `expireDueListings`.
        await listingsDal.update(listing.id, {
          status: "expired",
          scheduledPublishAt: null,
        });
        await notificationsService
          .createNotification({
            userId: listing.shipperId,
            type: "listing_expired",
            title: "Scheduled post missed its window",
            message: `"${listing.title}" could not go live before its pickup window closed. Edit the pickup date and try again.`,
            linkUrl: `/listing/${listing.id}`,
            data: { listingId: listing.id },
          })
          .catch((e) => console.error("listing_schedule_failed notification failed", e));
        continue;
      }

      await listingsDal.update(listing.id, {
        status: "open",
        expiresAt,
        scheduledPublishAt: null,
      });
      await notificationsService
        .createNotification({
          userId: listing.shipperId,
          type: "listing",
          title: "Your scheduled job is live",
          message: `"${listing.title}" is now on the board — carriers can start bidding.`,
          linkUrl: `/listing/${listing.id}`,
          data: { listingId: listing.id },
        })
        .catch((e) => console.error("listing_scheduled_published notification failed", e));
      published++;
    }

    return published;
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
      pickupNote: pickup.note,
      pickupContactName: pickup.contactName,
      pickupContactPhone: pickup.contactPhone,
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
      dropoffNote: dropoff.note,
      dropoffContactName: dropoff.contactName,
      dropoffContactPhone: dropoff.contactPhone,
    });
  }
  return out;
}

/**
 * Confirmation that a direct request went live: bell notification and email,
 * each independent and each swallowing its own failure so neither can turn a
 * successful `createListing` into a failed response
 * (listing_posted_feedback_spec.md §2).
 */
async function announceListingPosted(listing: Listing, shipperId: string) {
  await notificationsService
    .createNotification({
      userId: shipperId,
      type: "listing_posted",
      title: "Votre demande est en ligne",
      message: `"${listing.title}" est visible par les transporteurs.`,
      linkUrl: `/listing/${listing.id}`,
      data: { listingId: listing.id },
    })
    .catch((e) => console.error("listing_posted notification failed", e));

  await sendListingPostedEmail(listing, shipperId).catch((e) =>
    console.error("listing_posted email failed", e)
  );
}

async function sendListingPostedEmail(listing: Listing, shipperId: string) {
  const user = await getUserById(shipperId);
  if (!user?.email) return;

  await emailService.sendListingPostedEmail(user.email, {
    recipientName: user.name,
    listingTitle: listing.title,
    pickupCity: listing.pickupCity,
    dropoffCity: listing.dropoffCity,
    budgetLabel: formatCurrency(listing.budgetCents),
    listingUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://expeditoo.com"}/listing/${listing.id}`,
  });
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
