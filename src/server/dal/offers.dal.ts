import { db } from "@/db";
import { offers, type InsertOffer, type OfferStatus } from "@/db/schema/offers";
import { listings } from "@/db/schema/listings";
import { and, asc, desc, eq, min, ne, sql, count } from "drizzle-orm";

/**
 * Either the base client or an open transaction. The accept path runs several
 * of these calls inside one transaction, so every method takes an executor.
 */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const withCarrierAndVehicle = {
  carrier: true,
  vehicle: true,
} as const;

export const offersDal = {
  async create(data: InsertOffer, tx: Executor = db) {
    const [result] = await tx.insert(offers).values(data).returning();
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

  async updateStatus(id: string, status: OfferStatus, tx: Executor = db) {
    const [result] = await tx
      .update(offers)
      .set({ status, updatedAt: new Date() })
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
