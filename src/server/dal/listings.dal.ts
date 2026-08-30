import { db } from "@/db";
import {
  categories,
  listings,
  photos,
  type InsertListing,
  type InsertPhoto,
  type ListingStatus,
} from "@/db/schema/listings";

/** Stable id and slug for the fallback category, so the upsert is idempotent. */
const DEFAULT_CATEGORY_ID = "transport-general";
const DEFAULT_CATEGORY_SLUG = "transport-general";
import { shipments, type InsertShipment } from "@/db/schema/shipments";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  lte,
  lt,
  or,
  sql,
  count,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import {
  corridorFrame,
  KM_PER_DEGREE,
  type CorridorFrame,
} from "@/lib/route-corridor";
import {
  availabilityIntervals,
  type TimeSlot,
} from "@/lib/availability-window";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface BrowseFilters {
  categoryId?: string;
  q?: string;
  origin?: "direct" | "expedion";
  /** Where the driver starts. */
  fromLat?: number;
  fromLng?: number;
  /** Where they are going. Present only for a "sur mon trajet" search. */
  toLat?: number;
  toLng?: number;
  /** Radius around the departure, or half-width of the corridor. */
  radiusKm?: number;
  minBudget?: number;
  maxBudget?: number;
  pickupFrom?: Date;
  pickupUntil?: Date;
  /** Days the driver is free, `YYYY-MM-DD`, with the times of day within them. */
  days?: string[];
  slots?: TimeSlot[];
  /** The client's `getTimezoneOffset()`. */
  tzOffset?: number;
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

/**
 * How far a listing endpoint sits off the corridor, in km.
 *
 * A transcription of `positionOnCorridor` in `src/lib/route-corridor.ts`,
 * built from the frame that module computes — the projection, the mid-latitude
 * scaling and the clamp are its work, and only the point-to-segment arithmetic
 * is written twice. Change one and change the other
 * (board_route_search_spec.md §4.2).
 */
const corridorDetourKmSql = (
  frame: CorridorFrame,
  latColumn: AnyColumn,
  lngColumn: AnyColumn
): SQL<number> => {
  const dx = frame.bx - frame.ax;
  const dy = frame.by - frame.ay;
  const progress = corridorProgressSql(frame, latColumn, lngColumn);

  return sql<number>`sqrt(
    power(${lngColumn} * ${frame.lngScale} - (${frame.ax} + ${progress} * ${dx}), 2)
    + power(${latColumn} * ${KM_PER_DEGREE} - (${frame.ay} + ${progress} * ${dy}), 2)
  )`;
};

/**
 * How far along the corridor an endpoint sits, clamped to [0, 1].
 *
 * A zero-length corridor — one city typed into both fields — pins every point
 * to the departure, which turns the detour above into plain distance from it.
 * That is the limit of point-to-segment distance as the arrival approaches the
 * departure, so the degenerate case needs no branch.
 */
const corridorProgressSql = (
  frame: CorridorFrame,
  latColumn: AnyColumn,
  lngColumn: AnyColumn
): SQL<number> => {
  if (frame.lengthSq === 0) return sql<number>`0`;

  const dx = frame.bx - frame.ax;
  const dy = frame.by - frame.ay;

  return sql<number>`least(1, greatest(0, (
    (${lngColumn} * ${frame.lngScale} - ${frame.ax}) * ${dx}
    + (${latColumn} * ${KM_PER_DEGREE} - ${frame.ay}) * ${dy}
  ) / ${frame.lengthSq}))`;
};

/**
 * Photos, lowest `order` first — used by every read that returns them.
 *
 * `order` is the index the photo was uploaded at (`listingsService.createListing`
 * numbers them from the array), so row zero is the photo the requester led
 * with, and that is the one the job board puts on the card. Without an explicit
 * order Postgres may return the rows however it likes, so "the first photo"
 * would be a different photo between two loads of the same board.
 */
const photosInOrder = { orderBy: [asc(photos.order)] };

export const listingsDal = {
  async create(data: InsertListing, tx: Executor = db) {
    const [result] = await tx.insert(listings).values(data).returning();
    return result;
  },

  /**
   * The category a transport request falls into when nobody picked one.
   *
   * Upserted rather than looked up because `listings.category_id` is a foreign
   * key and an environment whose seed predates this row would otherwise fail
   * the insert — which reads as "posting a job is broken" rather than "this
   * database has no categories yet". Escalation learned the same lesson; see
   * `resolveCategoryId` in `expedion-escalation.service.ts`.
   */
  async ensureDefaultCategory(tx: Executor = db) {
    await tx
      .insert(categories)
      .values({
        id: DEFAULT_CATEGORY_ID,
        name: "Transport (général)",
        slug: DEFAULT_CATEGORY_SLUG,
        description:
          "Demandes de transport déposées directement sur Expeditoo.",
      })
      .onConflictDoNothing();

    const row = await tx.query.categories.findFirst({
      where: eq(categories.slug, DEFAULT_CATEGORY_SLUG),
    });
    return row?.id ?? DEFAULT_CATEGORY_ID;
  },

  async getById(id: string, tx: Executor = db) {
    return await tx.query.listings.findFirst({
      where: eq(listings.id, id),
      with: { photos: photosInOrder, shipper: true, category: true },
    });
  },

  /**
   * The listing minted from a given Expedion quote, if escalation got that far.
   * `externalRef` holds the quote id, so this is the idempotency key that lets
   * a retried escalation adopt an orphaned listing rather than mint a second.
   */
  async getByExternalRef(externalRef: string, tx: Executor = db) {
    return await tx.query.listings.findFirst({
      where: and(
        eq(listings.origin, "expedion"),
        eq(listings.externalRef, externalRef)
      ),
      with: { photos: photosInOrder, shipper: true, category: true },
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
      with: { photos: photosInOrder, category: true },
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
    if (filters.origin) {
      conditions.push(eq(listings.origin, filters.origin));
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

    // The days a driver can drive, as instants. A job matches when its pickup
    // window overlaps any one of them — overlap rather than containment,
    // because narrowing a fortnight-wide window is the point.
    const intervals = availabilityIntervals(
      filters.days ?? [],
      filters.slots ?? [],
      filters.tzOffset ?? 0
    );

    if (intervals.length > 0) {
      conditions.push(
        or(
          ...intervals.map((interval) =>
            and(
              lte(listings.pickupFrom, interval.end),
              gte(listings.pickupUntil, interval.start)
            )
          )
        )
      );
    }

    // The search mode is derived, never declared: an arrival makes this a
    // corridor, its absence a radius (board_route_search_spec.md §2).
    const hasOrigin =
      filters.fromLat !== undefined &&
      filters.fromLng !== undefined &&
      filters.radiusKm !== undefined;
    const frame =
      hasOrigin && filters.toLat !== undefined && filters.toLng !== undefined
        ? corridorFrame(
            { lat: filters.fromLat!, lng: filters.fromLng! },
            { lat: filters.toLat!, lng: filters.toLng! }
          )
        : null;

    /** Distance from the driver, however they described where they are going. */
    const proximityKm = frame
      ? corridorDetourKmSql(frame, listings.pickupLat, listings.pickupLng)
      : hasOrigin
        ? distanceKmSql(filters.fromLat!, filters.fromLng!)
        : null;

    if (frame) {
      // Both ends inside the corridor, and the load travelling the driver's
      // way: Bordeaux → Paris is offered Angoulême → Orléans, never the
      // reverse.
      conditions.push(
        lte(proximityKm!, filters.radiusKm!),
        lte(
          corridorDetourKmSql(frame, listings.dropoffLat, listings.dropoffLng),
          filters.radiusKm!
        ),
        lte(
          corridorProgressSql(frame, listings.pickupLat, listings.pickupLng),
          corridorProgressSql(frame, listings.dropoffLat, listings.dropoffLng)
        )
      );
    } else if (proximityKm) {
      conditions.push(lte(proximityKm, filters.radiusKm!));
    }

    const where = and(...conditions);
    const orderBy = {
      created_desc: [desc(listings.createdAt)],
      budget_desc: [desc(listings.budgetCents)],
      budget_asc: [asc(listings.budgetCents)],
      pickup_asc: [asc(listings.pickupFrom)],
      distance_asc: proximityKm
        ? [asc(proximityKm)]
        : [desc(listings.createdAt)],
    }[filters.sort ?? "created_desc"] ?? [desc(listings.createdAt)];

    const items = await tx.query.listings.findMany({
      where,
      with: { photos: photosInOrder, category: true, shipper: true },
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
