import { db } from "@/db";
import {
  offerSlots,
  offers,
  type InsertOffer,
  type InsertOfferSlot,
  type OfferStatus,
} from "@/db/schema/offers";
import { listings } from "@/db/schema/listings";
import { and, asc, desc, eq, isNotNull, min, ne, sql, count } from "drizzle-orm";

/**
 * Either the base client or an open transaction. The accept path runs several
 * of these calls inside one transaction, so every method takes an executor.
 */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Slots come back earliest first, everywhere. Nothing downstream wants the
 * order the carrier typed them in — the offer card, the shipment and the
 * stored schedule all want the clock.
 *
 * Held apart from the `as const` below on purpose: that assertion would make
 * `orderBy` a readonly tuple, and drizzle's relational config asks for a
 * mutable array.
 */
const slotsEarliestFirst = { orderBy: [asc(offerSlots.startsAt)] };

const withCarrierAndVehicle = {
  carrier: true,
  vehicle: true,
  slots: slotsEarliestFirst,
} as const;

export const offersDal = {
  async create(data: InsertOffer, tx: Executor = db) {
    const [result] = await tx.insert(offers).values(data).returning();
    return result;
  },

  /** The carrier's proposal. Empty for the lanes that propose nothing. */
  async createSlots(rows: InsertOfferSlot[], tx: Executor = db) {
    if (rows.length === 0) return [];
    return await tx.insert(offerSlots).values(rows).returning();
  },

  async listSlots(offerId: string, tx: Executor = db) {
    return await tx
      .select()
      .from(offerSlots)
      .where(eq(offerSlots.offerId, offerId))
      .orderBy(asc(offerSlots.startsAt));
  },

  /**
   * Books a slot: the offer's schedule becomes the one actually chosen.
   *
   * Called inside `commitAward`'s transaction so the shipment reads the booked
   * pair rather than the earliest proposal (offer_time_slots_spec.md §4).
   */
  async updateSchedule(
    id: string,
    schedule: { estimatedPickup: Date; estimatedDelivery: Date },
    tx: Executor = db
  ) {
    const [result] = await tx
      .update(offers)
      .set({ ...schedule, updatedAt: new Date() })
      .where(eq(offers.id, id))
      .returning();
    return result;
  },

  async getById(id: string, tx: Executor = db) {
    return await tx.query.offers.findFirst({
      where: eq(offers.id, id),
      with: withCarrierAndVehicle,
    });
  },

  /** Locks the row for the accept transaction. */
  async getByIdForUpdate(id: string, tx: Executor) {
    const [result] = await tx
      .select()
      .from(offers)
      .where(eq(offers.id, id))
      .for("update");
    return result;
  },

  /**
   * The carrier's live offer on a listing, if any. Withdrawn offers do not
   * count - withdrawing frees the slot for a replacement.
   */
  async getLiveByCarrierAndListing(
    listingId: string,
    carrierId: string,
    tx: Executor = db
  ) {
    return await tx.query.offers.findFirst({
      where: and(
        eq(offers.listingId, listingId),
        eq(offers.carrierId, carrierId),
        ne(offers.status, "withdrawn")
      ),
    });
  },

  async listByListing(
    listingId: string,
    sort: string = "price_asc",
    tx: Executor = db
  ) {
    const orderBy = {
      price_asc: [asc(offers.priceCents)],
      price_desc: [desc(offers.priceCents)],
      pickup_asc: [asc(offers.estimatedPickup)],
      created_desc: [desc(offers.createdAt)],
      // Rating lives on the joined user; sorted in the service after load.
      rating_desc: [asc(offers.priceCents)],
    }[sort] ?? [asc(offers.priceCents)];

    return await tx.query.offers.findMany({
      where: eq(offers.listingId, listingId),
      with: withCarrierAndVehicle,
      orderBy,
    });
  },

  async listByCarrier(
    carrierId: string,
    filters: { status?: OfferStatus; page: number; limit: number },
    tx: Executor = db
  ) {
    const conditions = [eq(offers.carrierId, carrierId)];
    if (filters.status) conditions.push(eq(offers.status, filters.status));

    return await tx.query.offers.findMany({
      where: and(...conditions),
      with: { ...withCarrierAndVehicle, listing: true },
      orderBy: [desc(offers.createdAt)],
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
    });
  },

  /** The public view: how many bids and how low, never who. */
  async getAggregate(listingId: string, tx: Executor = db) {
    const [result] = await tx
      .select({
        offersCount: count(offers.id),
        lowestPriceCents: min(offers.priceCents),
      })
      .from(offers)
      .where(and(eq(offers.listingId, listingId), eq(offers.status, "pending")));

    return {
      offersCount: Number(result?.offersCount ?? 0),
      lowestPriceCents: result?.lowestPriceCents ?? null,
    };
  },

  /**
   * Withdraws every bid still standing for a carrier and gives each job its
   * count back, the way `offersService.withdrawOffer` does one at a time.
   * Returns how many went.
   */
  async withdrawAllPendingForCarrier(carrierUserId: string, tx: Executor = db) {
    const withdrawn = await tx
      .update(offers)
      .set({ status: "withdrawn", updatedAt: new Date() })
      .where(and(eq(offers.carrierId, carrierUserId), eq(offers.status, "pending")))
      .returning({ listingId: offers.listingId });
    for (const { listingId } of withdrawn) {
      await offersDal.incrementListingOffersCount(listingId, -1, tx);
    }
    return withdrawn.length;
  },

  /**
   * Writes the proposal and negotiation columns (client_feedback_2026_10_29
   * _spec.md §B1, §B6) — and `priceCents`, which a counter-offer's answer
   * moves. Only while the offer is still `pending`: an answer that loses a
   * race to the award changes nothing, and the caller reads `undefined`.
   */
  async updateNegotiation(
    id: string,
    data: Partial<
      Pick<
        InsertOffer,
        | "priceCents"
        | "proposedAt"
        | "proposedBy"
        | "counterPriceCents"
        | "counterNote"
        | "counteredAt"
        | "counterRounds"
      >
    >,
    tx: Executor = db
  ) {
    const [row] = await tx
      .update(offers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(offers.id, id), eq(offers.status, "pending")))
      .returning();
    return row;
  },

  /** Clears Expeditoo's pick on every other offer of a job (§B1: one per job). */
  async clearProposalsForListing(listingId: string, tx: Executor = db) {
    await tx
      .update(offers)
      .set({ proposedAt: null, proposedBy: null, updatedAt: new Date() })
      .where(and(eq(offers.listingId, listingId), isNotNull(offers.proposedAt)));
  },

  async updateStatus(id: string, status: OfferStatus, tx: Executor = db) {
    const [result] = await tx
      .update(offers)
      .set({ status, updatedAt: new Date() })
      .where(eq(offers.id, id))
      .returning();
    return result;
  },

  /** Records that the carrier took this job themselves rather than being picked. */
  async markSelfAccepted(id: string, tx: Executor = db) {
    const [result] = await tx
      .update(offers)
      .set({ selfAccepted: true, updatedAt: new Date() })
      .where(eq(offers.id, id))
      .returning();
    return result;
  },

  /** Used by the accept transaction to reject every losing bid at once. */
  async setPendingStatusForListing(
    listingId: string,
    status: OfferStatus,
    tx: Executor = db,
    exceptOfferId?: string
  ) {
    const conditions = [
      eq(offers.listingId, listingId),
      eq(offers.status, "pending"),
    ];
    if (exceptOfferId) conditions.push(ne(offers.id, exceptOfferId));

    return await tx
      .update(offers)
      .set({ status, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
  },

  async incrementListingOffersCount(
    listingId: string,
    delta: number,
    tx: Executor = db
  ) {
    await tx
      .update(listings)
      .set({
        offersCount: sql`GREATEST(${listings.offersCount} + ${delta}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, listingId));
  },
};
