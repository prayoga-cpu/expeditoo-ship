import { db } from "@/db";
import {
  listings,
  photos,
  type InsertListing,
  type InsertPhoto,
  type ListingStatus,
} from "@/db/schema/listings";
import { shipments, type InsertShipment } from "@/db/schema/shipments";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  lte,
  lt,
  sql,
  count,
  type SQL,
} from "drizzle-orm";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface BrowseFilters {
  categoryId?: string;
  q?: string;
  nearLat?: number;
  nearLng?: number;
  radiusKm?: number;
  minBudget?: number;
  maxBudget?: number;
  pickupFrom?: Date;
  pickupUntil?: Date;
  maxWeightKg?: number;
  sort?: string;
  page: number;
  limit: number;
}

/**
 * Great-circle distance in km between a listing's pickup point and a target,
 * as a SQL expression. Good enough for marketplace radius filtering; PostGIS
 * would be the move if this ever needs to be exact.
 */
const distanceKmSql = (lat: number, lng: number): SQL<number> =>
  sql<number>`(
    6371 * acos(
      least(1, greatest(-1,
        cos(radians(${lat})) * cos(radians(${listings.pickupLat}))
        * cos(radians(${listings.pickupLng}) - radians(${lng}))
        + sin(radians(${lat})) * sin(radians(${listings.pickupLat}))
      ))
    )
  )`;

export const listingsDal = {
  async create(data: InsertListing, tx: Executor = db) {
    const [result] = await tx.insert(listings).values(data).returning();
    return result;
  },

  async getById(id: string, tx: Executor = db) {
    return await tx.query.listings.findFirst({
      where: eq(listings.id, id),
      with: { photos: true, shipper: true, category: true },
    });
  },

  /** Locks the listing for the accept transaction. */
  async getByIdForUpdate(id: string, tx: Executor) {
    const [result] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, id))
      .for("update");
    return result;
  },

  async getByShipperId(
    shipperId: string,
    status?: ListingStatus,
    tx: Executor = db
  ) {
    const conditions = [eq(listings.shipperId, shipperId)];
    if (status) conditions.push(eq(listings.status, status));

    return await tx.query.listings.findMany({
      where: and(...conditions),
      with: { photos: true, category: true },
      orderBy: [desc(listings.createdAt)],
    });
  },

  async update(id: string, data: Partial<InsertListing>, tx: Executor = db) {
    const [result] = await tx
      .update(listings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(listings.id, id))
      .returning();
    return result;
  },

  async delete(id: string, tx: Executor = db) {
    await tx.delete(listings).where(eq(listings.id, id));
  },

  /** Marketplace browse. Only open jobs are ever returned here. */
  async browse(filters: BrowseFilters, tx: Executor = db) {
    const conditions: (SQL | undefined)[] = [
      eq(listings.status, "open"),
      gte(listings.expiresAt, new Date()),
    ];

    if (filters.categoryId) {
      conditions.push(eq(listings.categoryId, filters.categoryId));
    }
    if (filters.q) {
      conditions.push(
        sql`to_tsvector('french', ${listings.title} || ' ' || ${listings.description})
            @@ plainto_tsquery('french', ${filters.q})`
      );
    }
    if (filters.minBudget !== undefined) {
      conditions.push(gte(listings.budgetCents, filters.minBudget));
    }
    if (filters.maxBudget !== undefined) {
      conditions.push(lte(listings.budgetCents, filters.maxBudget));
    }
    if (filters.pickupFrom) {
      conditions.push(gte(listings.pickupUntil, filters.pickupFrom));
    }
    if (filters.pickupUntil) {
      conditions.push(lte(listings.pickupFrom, filters.pickupUntil));
    }
    if (filters.maxWeightKg !== undefined) {
      conditions.push(lte(listings.weightKg, filters.maxWeightKg));
    }

    const hasGeo =
      filters.nearLat !== undefined &&
      filters.nearLng !== undefined &&
      filters.radiusKm !== undefined;

    if (hasGeo) {
      conditions.push(
        lte(distanceKmSql(filters.nearLat!, filters.nearLng!), filters.radiusKm!)
      );
    }

    const where = and(...conditions);
    const orderBy = {
      created_desc: [desc(listings.createdAt)],
      budget_desc: [desc(listings.budgetCents)],
      budget_asc: [asc(listings.budgetCents)],
      pickup_asc: [asc(listings.pickupFrom)],
      distance_asc: hasGeo
        ? [asc(distanceKmSql(filters.nearLat!, filters.nearLng!))]
        : [desc(listings.createdAt)],
    }[filters.sort ?? "created_desc"] ?? [desc(listings.createdAt)];

    const items = await tx.query.listings.findMany({
      where,
      with: { photos: true, category: true, shipper: true },
      orderBy,
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
    });

    const [totals] = await tx
      .select({ total: count(listings.id) })
      .from(listings)
      .where(where);

    return { items, total: Number(totals?.total ?? 0) };
  },

  /** Open jobs past their window, for the expiry cron. */
  async findExpired(now: Date, tx: Executor = db) {
    return await tx.query.listings.findMany({
      where: and(eq(listings.status, "open"), lt(listings.expiresAt, now)),
    });
  },

  async incrementViews(id: string, tx: Executor = db) {
    await tx
      .update(listings)
      .set({ views: sql`${listings.views} + 1` })
      .where(eq(listings.id, id));
  },

  // ---- Photos ----

  async addPhotos(rows: InsertPhoto[], tx: Executor = db) {
    if (rows.length === 0) return [];
    return await tx.insert(photos).values(rows).returning();
  },

  async deletePhotos(listingId: string, tx: Executor = db) {
    await tx.delete(photos).where(eq(photos.listingId, listingId));
  },

  // ---- Shipment handoff ----
  // The award transaction creates the shipment alongside the listing update,
  // so those writes live here rather than crossing into the shipments DAL.

  async createShipment(data: InsertShipment, tx: Executor = db) {
    const [result] = await tx.insert(shipments).values(data).returning();
    return result;
  },

  async getShipmentByOfferId(offerId: string, tx: Executor = db) {
    return await tx.query.shipments.findFirst({
      where: eq(shipments.offerId, offerId),
    });
  },
};
