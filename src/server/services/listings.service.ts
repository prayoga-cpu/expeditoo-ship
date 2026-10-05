import { nanoid } from "nanoid";
import { db } from "@/db";
import { listingsDal, type BrowseFilters } from "@/server/dal/listings.dal";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { offersService } from "@/server/services/offers.service";
import { notificationsService } from "@/server/services/notifications.service";
import { carrierRouteAlertsService } from "@/server/services/carrier-route-alerts.service";
import { emailService } from "@/server/services/email.service";
import { isSystemAccount } from "@/server/services/account-policy";
import {
  resolveListingViewer,
  searchesExactLocation,
  toListingView,
  viewFor,
} from "@/server/services/listing-view";
import { getUserById } from "@/server/dal/users.dal";
import { formatCurrency } from "@/lib/currency";
import { expiresAtFor } from "@/lib/listing-window";
import { ISO_WEEKDAYS, TIME_SLOTS } from "@/lib/availability-window";
import {
  MATERIAL_FIELDS,
  type CreateListingInput,
  type UpdateListingInput,
} from "@/server/dto/listings.dto";
import type { InsertListing, Listing } from "@/db/schema/listings";
import type { Viewer } from "@/server/services/shipment.service";

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

/**
 * The publication rules, for a job that is actually going live — now, or at
 * its scheduled instant. Returns the bidding deadline.
 */
function assertPublishable(data: CreateListingInput, now: Date): Date {
  if (data.pickupFrom <= now) throw err("PICKUP_IN_PAST", 400);

  // A schedule is a promise to go live later; the promise itself has to be
  // in the future, or "later" is a lie.
  if (data.scheduledPublishAt && data.scheduledPublishAt <= now) {
    throw err("SCHEDULED_PUBLISH_IN_PAST", 400);
  }

  // The bidding window is measured from whichever moment the job actually
  // reaches the board: the scheduled instant for a scheduled job, `now`
  // otherwise. A schedule whose own instant leaves no usable window (e.g. at
  // or after `pickupFrom`) fails here with the same `PICKUP_TOO_SOON` a normal
  // too-soon pickup already gets.
  return resolveExpiresAt(data.pickupFrom, data.scheduledPublishAt ?? now);
}

/**
 * A draft is not going anywhere, so no publication rule applies to it — the
 * comment above `PICKUP_IN_PAST` always said so, but `resolveExpiresAt` ran for
 * drafts too and refused the same date as `PICKUP_TOO_SOON`, which is the
 * toast the client got for pressing "Enregistrer le brouillon"
 * (publication_timing_spec.md §2). `expires_at` is NOT NULL, so a draft gets a
 * placeholder: every reader of the column filters on `status = 'open'` first,
 * and going live recomputes it — `saveDraft` through `assertPublishable`, the
 * scheduler in `settleScheduled`.
 */
function draftExpiresAt(pickupFrom: Date, now: Date): Date {
  return expiresAtFor(pickupFrom, now) ?? pickupFrom;
}

/** Going live now — not saved as a draft, not scheduled for later. */
const isLiveNow = (data: CreateListingInput) =>
  data.publish && !data.scheduledPublishAt;

/**
 * What a request's form decides, as columns — shared by a new request and a
 * saved one being finished, so the two can never map a field differently
 * (draft_requests_spec.md §3).
 *
 * Every optional field is written explicitly — `null`, or the full set for
 * the availability columns — never left `undefined`. An insert reads
 * `undefined` as the column default, but an update skips the column: a size,
 * floor, note or packaging state the requester cleared while finishing a
 * draft would keep its old value.
 */
function toColumns(data: CreateListingInput, expiresAt: Date, now: Date) {
  return {
    status: !data.publish
      ? ("draft" as const)
      : data.scheduledPublishAt
        ? ("scheduled" as const)
        : ("open" as const),
    title: data.title,
    description: data.description,
    weightKg: data.weightKg,
    lengthCm: data.lengthCm ?? null,
    widthCm: data.widthCm ?? null,
    heightCm: data.heightCm ?? null,
    quantity: data.quantity,
    isFragile: data.isFragile,
    needsHelp: data.needsHelp,
    packagingLevel: data.packagingLevel ?? null,
    needsProtection: data.needsProtection,
    needsPackaging: data.needsPackaging,

    pickupLat: data.pickup.lat ?? null,
    pickupLng: data.pickup.lng ?? null,
    pickupAddress: data.pickup.address,
    pickupCity: data.pickup.city,
    pickupPostalCode: data.pickup.postalCode,
    pickupLocationType: data.pickup.locationType,
    pickupFloor: data.pickup.floor ?? null,
    pickupHasLift: data.pickup.hasLift ?? null,
    pickupNote: data.pickup.note ?? null,
    pickupContactName: data.pickup.contactName ?? null,
    pickupContactPhone: data.pickup.contactPhone ?? null,

    dropoffLat: data.dropoff.lat ?? null,
    dropoffLng: data.dropoff.lng ?? null,
    dropoffAddress: data.dropoff.address,
    dropoffCity: data.dropoff.city,
    dropoffPostalCode: data.dropoff.postalCode,
    dropoffLocationType: data.dropoff.locationType,
    dropoffFloor: data.dropoff.floor ?? null,
    dropoffHasLift: data.dropoff.hasLift ?? null,
    dropoffNote: data.dropoff.note ?? null,
    dropoffContactName: data.dropoff.contactName ?? null,
    dropoffContactPhone: data.dropoff.contactPhone ?? null,

    pickupFrom: data.pickupFrom,
    pickupUntil: data.pickupUntil,
    dropoffFrom: data.dropoffFrom,
    dropoffUntil: data.dropoffUntil,
    isFlexible: data.isFlexible,
    // Absent means unrestricted: the full set, which is also the column
    // default (request_availability_spec.md §2).
    pickupDays: data.pickupDays ?? [...ISO_WEEKDAYS],
    pickupPeriods: data.pickupPeriods ?? [...TIME_SLOTS],
    dropoffDays: data.dropoffDays ?? [...ISO_WEEKDAYS],
    dropoffPeriods: data.dropoffPeriods ?? [...TIME_SLOTS],

    budgetCents: data.budgetCents,
    expiresAt,
    // The column means "while status is `scheduled`", and nothing publishes a
    // draft at its scheduled time — so a draft keeps none.
    scheduledPublishAt: data.publish ? (data.scheduledPublishAt ?? null) : null,
    // The moment it went live, when that is now; the scheduler stamps its own.
    publishedAt: isLiveNow(data) ? now : null,
  } satisfies Partial<InsertListing>;
}

function toInsert(
  shipperId: string,
  data: CreateListingInput,
  expiresAt: Date,
  categoryId: string,
  now: Date
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
    ...toColumns(data, expiresAt, now),
  };
}

/**
 * One due request, decided under its row lock: opened with an expiry
 * re-derived from its pickup as it now stands, or expired when that pickup
 * leaves no time to bid. Null when it is no longer the scheduler's — saved,
 * re-scheduled, un-scheduled, published or deleted since the run read it, or
 * being saved this instant (draft_requests_spec.md §5).
 */
function settleScheduled(id: string, now: Date) {
  return db.transaction(async (tx) => {
    const listing = await listingsDal.lockDueScheduled(id, now, tx);
    if (!listing) return null;

    let expiresAt: Date;
    try {
      expiresAt = resolveExpiresAt(listing.pickupFrom, now);
    } catch {
      // Never opened, so it never took an offer — nothing for
      // `expirePendingOffers` to do here, unlike `expireDueListings`.
      const expired = await listingsDal.updateIfStatus(
        id,
        "scheduled",
        { status: "expired", scheduledPublishAt: null },
        tx
      );
      return expired ? { live: false as const, listing: expired } : null;
    }

    const live = await listingsDal.updateIfStatus(
      id,
      "scheduled",
      { status: "open", expiresAt, scheduledPublishAt: null, publishedAt: now },
      tx
    );
    return live ? { live: true as const, listing: live } : null;
  });
}

const photoRows = (listingId: string, urls: string[]) =>
  urls.map((url, order) => ({ id: nanoid(), listingId, url, order }));

/**
 * Everything that happens the moment a request goes live, for a new one and
 * a finished draft alike: the requester's bell and email, and the carriers
 * whose declared trajet it fits.
 *
 * The system account owns every escalated listing and nobody signs into it to
 * read an email or a bell notification — `expedionEscalationService` reaches
 * `createListing` with that account's id (listing_posted_feedback_spec.md §1).
 * `notifyRouteMatches: false` is `assignDirect`'s: it awards a pre-chosen
 * driver moments later, so alerting the board would be spurious
 * (carrier_route_alerts_spec.md §3).
 */
async function goLive(
  listing: Listing,
  shipperId: string,
  options: { notifyRouteMatches?: boolean } = {}
) {
  if (!isSystemAccount(shipperId)) {
    await announceListingPosted(listing, shipperId);
  }
  if (options.notifyRouteMatches !== false) {
    await carrierRouteAlertsService
      .notifyMatchingCarriers(listing)
      .catch((e) => console.error("carrier_route_match notify failed", e));
  }
}

/**
 * Why a draft write found nothing to write: someone else's, gone, or already
 * live. Not-found rather than forbidden for someone else's, so an unpublished
 * request does not leak its own existence.
 */
async function unpublishedError(listingId: string, shipperId: string) {
  const row = await listingsDal.getById(listingId);
  if (!row || row.shipperId !== shipperId) return err("LISTING_NOT_FOUND", 404);
  return err("LISTING_NOT_DRAFT", 409);
}

function assertOwner(listing: Listing | undefined, userId: string): Listing {
  if (!listing) throw err("LISTING_NOT_FOUND", 404);
  if (listing.shipperId !== userId) throw err("FORBIDDEN_NOT_OWNER", 403);
  return listing;
}

export const listingsService = {
  /**
   * `options.notifyRouteMatches` defaults true and is not part of the
   * client-facing DTO — `escalate` is the one caller that passes `false`, for
   * `assignDirect` (carrier_route_alerts_spec.md §3): that path awards a
   * pre-chosen driver moments after this returns, with no gap another carrier
   * could act in, so alerting the rest of the board would be spurious.
   */
  async createListing(
    shipperId: string,
    data: CreateListingInput,
    options: { notifyRouteMatches?: boolean } = {}
  ) {
    const now = new Date();
    const expiresAt = data.publish
      ? assertPublishable(data, now)
      : draftExpiresAt(data.pickupFrom, now);
    // A requester describes an object, not a taxonomy node, so the category is
    // resolved here when the caller did not name one.
    const categoryId =
      data.categoryId ?? (await listingsDal.ensureDefaultCategory());
    const listing = await listingsDal.create(
      toInsert(shipperId, data, expiresAt, categoryId, now)
    );

    if (data.photos.length > 0) {
      await listingsDal.addPhotos(photoRows(listing.id, data.photos));
    }

    // A draft or a scheduled job is not live yet: nothing to announce until
    // it is (`saveDraft`, or the scheduler's `publishScheduled`).
    if (isLiveNow(data)) await goLive(listing, shipperId, options);

    return listing;
  },

  /** A draft or scheduled request, as its owner reads it to finish it. */
  async getDraft(shipperId: string, listingId: string) {
    const listing = await listingsDal.getById(listingId);
    if (!listing || listing.shipperId !== shipperId) {
      throw err("LISTING_NOT_FOUND", 404);
    }
    if (listing.status !== "draft" && listing.status !== "scheduled") {
      throw err("LISTING_NOT_DRAFT", 409);
    }
    return toListingView(listing, "full");
  },

  /**
   * Finishes a request that has not gone live: saved again as a draft,
   * scheduled, or published now — with exactly a new request's rules and,
   * when it goes live, its announcement (draft_requests_spec.md §3). The
   * write is conditional, so only one of two racing tabs wins.
   */
  async saveDraft(shipperId: string, listingId: string, data: CreateListingInput) {
    const now = new Date();
    const expiresAt = data.publish
      ? assertPublishable(data, now)
      : draftExpiresAt(data.pickupFrom, now);

    const listing = await db.transaction(async (tx) => {
      const updated = await listingsDal.updateUnpublished(
        listingId,
        shipperId,
        toColumns(data, expiresAt, now),
        tx
      );
      if (updated) {
        await listingsDal.replacePhotos(listingId, photoRows(listingId, data.photos), tx);
      }
      return updated;
    });
    if (!listing) throw await unpublishedError(listingId, shipperId);

    if (isLiveNow(data)) await goLive(listing, shipperId);
    return toListingView(listing, "full");
  },

  /** Deletes a draft or scheduled request outright: nobody else has seen it. */
  async deleteDraft(shipperId: string, listingId: string) {
    const deleted = await listingsDal.deleteUnpublished(listingId, shipperId);
    if (!deleted) throw await unpublishedError(listingId, shipperId);
    return { deleted: true as const };
  },

  /** A scheduled request back to a draft: no schedule, nothing published. */
  async unschedule(shipperId: string, listingId: string) {
    const listing = await listingsDal.getById(listingId);
    if (!listing || listing.shipperId !== shipperId) {
      throw err("LISTING_NOT_FOUND", 404);
    }
    const now = new Date();
    const updated = await listingsDal.updateIfStatus(listingId, "scheduled", {
      status: "draft",
      scheduledPublishAt: null,
      expiresAt: draftExpiresAt(listing.pickupFrom, now),
    });
    if (!updated) throw err("LISTING_NOT_SCHEDULED", 409);
    return toListingView(updated, "full");
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

  /**
   * The board, as the caller may read it: each job projected for them —
   * never the DAL's rows, which carry the requester's whole account
   * (listing_privacy_spec.md §3).
   *
   * The viewer is resolved before the query, not beside it: who is asking
   * also decides how precisely the location filters may answer. Run on the
   * exact pins for someone shown rounded ones, a radius search gives the pin
   * back one question at a time.
   */
  async browse(filters: BrowseFilters, viewerId: string) {
    const viewer = await resolveListingViewer(viewerId);
    const result = await listingsDal.browse(filters, {
      exactLocation: searchesExactLocation(viewer),
    });
    return {
      ...result,
      items: result.items.map((listing) => viewFor(listing, viewer)),
    };
  },

  /** A requester's live jobs, as the caller may read them. */
  async getOpenListingsOf(userId: string, viewerId: string) {
    const [rows, viewer] = await Promise.all([
      listingsDal.getByShipperId(userId, "open"),
      resolveListingViewer(viewerId),
    ]);
    return rows.map((listing) => viewFor(listing, viewer));
  },

  /** `GET /api/admin/listings` — every status, admin/operator only. */
  async adminList(
    viewer: Viewer,
    filters: {
      status?: Listing["status"];
      origin?: Listing["origin"];
      posted?: boolean;
      page: number;
      limit: number;
    }
  ) {
    if (!viewer.isAdmin && !viewer.isOperator) {
      throw err("FORBIDDEN_ROLE", 403);
    }
    return await listingsDal.adminList(filters);
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

    return viewFor(listing, await resolveListingViewer(viewerId));
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

    // The owner's own rows, so the `full` view — through the same allow-list
    // as every other listing route rather than whole — and the delivery,
    // which `toDelivery` has already projected (listing_privacy_spec.md §2).
    return listings.map(
      (listing): OwnRequest => ({
        ...toListingView(listing, "full"),
        delivery: toDelivery(byListing.get(listing.id)),
      })
    );
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
   * `expiresAt` is re-derived against the actual firing time rather than
   * trusting the stored value — the cron that calls this can run late — so a
   * job whose pickup window closed in the meantime is expired instead of
   * opened dead. Each request is decided under its row lock
   * (`settleScheduled`), and everything said about it afterwards is said from
   * the row as written, never from the copy this run read first.
   */
  async publishScheduled(now = new Date()) {
    const due = await listingsDal.findDueScheduled(now);
    let published = 0;

    for (const { id } of due) {
      const outcome = await settleScheduled(id, now);
      if (!outcome) continue;
      const { listing } = outcome;
      if (!outcome.live) {
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
      await carrierRouteAlertsService
        .notifyMatchingCarriers(listing)
        .catch((e) => console.error("carrier_route_match notify failed", e));
      published++;
    }

    return published;
  },
};

type DeliveredRow = Awaited<
  ReturnType<typeof shipmentsDal.listDeliveredForListings>
>[number];

/** One of the caller's own requests: the full view, and its delivery if any. */
type OwnRequest = Record<string, unknown> & {
  delivery: ReturnType<typeof toDelivery>;
};

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
      // Explicit null: `pickup` arrives whole or not at all (never a partial
      // patch of just some of its fields), so an absent lat/lng here means
      // the edit genuinely switched to a pin-less endpoint and must clear
      // the stored value — leaving it `undefined` would drop it from the
      // `SET` clause and silently keep the old coordinates.
      pickupLat: pickup.lat ?? null,
      pickupLng: pickup.lng ?? null,
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
      dropoffLat: dropoff.lat ?? null,
      dropoffLng: dropoff.lng ?? null,
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
      message: `"${listing.title}" (réf. ${listing.reference}) est visible par les transporteurs.`,
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
  if (user.preferences?.notifications?.email?.listingPublished === false) return;

  await emailService.sendListingPostedEmail(user.email, {
    recipientName: user.name,
    listingTitle: listing.title,
    listingReference: listing.reference,
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
