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
  corridorPath,
  KM_PER_DEGREE,
  type CorridorPath,
  type CorridorSegment,
  type LatLng,
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
  /** Étapes between the two, in order. */
  via?: LatLng[];
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
 * Photos, lowest `order` first — used by every read that returns them.
 *
 * `order` is the index the photo was uploaded at (`listingsService.createListing`
 * numbers them from the array), so row zero is the photo the requester led
 * with, and that is the one the job board puts on the card. Without an explicit
 * order Postgres may return the rows however it likes, so "the first photo"
 * would be a different photo between two loads of the same board.
 */
const photosInOrder = { orderBy: [asc(photos.order)] };

/**
 * A projected constant, pinned to a floating-point type.
 *
 * Every one of these reaches Postgres as a bind parameter whose type is
 * inferred from its surroundings. A zero-length leg contributes a literal `0`
 * to that context, which was enough to infer *integer* for the whole
 * expression — so `ax = 375.894` arrived as "invalid input syntax for type
 * integer" and the board 500'd for anyone who typed one city into both fields.
 * Stating the type removes the inference.
 */
const real = (value: number): SQL<number> =>
  sql<number>`${value}::double precision`;

/**
 * One leg's point-to-segment terms, as SQL.
 *
 * A transcription of `positionOnSegment` in `src/lib/route-corridor.ts`, built
 * from the path that module computes — the projection, the mean-latitude
 * scaling and the clamp are its work, and only this arithmetic is written
 * twice. Change one and change the other (board_route_search_spec.md §4.2).
 */
const segmentTerms = (
  segment: CorridorSegment,
  lngScale: number,
  latColumn: AnyColumn,
  lngColumn: AnyColumn
) => {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;

  const px = sql`(${lngColumn} * ${real(lngScale)})`;
  const py = sql`(${latColumn} * ${real(KM_PER_DEGREE)})`;

  // A zero-length leg pins every point to its start, which turns the detour
  // below into plain distance from it — the limit as the end approaches the
  // start, so the degenerate case needs no branch.
  const t =
    segment.lengthSq === 0
      ? real(0)
      : sql`least(1, greatest(0, (
          (${px} - ${real(segment.ax)}) * ${real(dx)}
          + (${py} - ${real(segment.ay)}) * ${real(dy)}
        ) / ${real(segment.lengthSq)}))`;

  return {
    detourKm: sql<number>`sqrt(
      power(${px} - (${real(segment.ax)} + ${t} * ${real(dx)}), 2)
      + power(${py} - (${real(segment.ay)} + ${t} * ${real(dy)}), 2)
    )`,
    progressKm: sql<number>`(${real(segment.startKm)} + ${t} * ${real(segment.lengthKm)})`,
  };
};

/** How far a listing endpoint sits off the nearest leg, in km. */
const pathDetourKmSql = (
  path: CorridorPath,
  latColumn: AnyColumn,
  lngColumn: AnyColumn
): SQL<number> => {
  const detours = path.segments.map(
    (segment) => segmentTerms(segment, path.lngScale, latColumn, lngColumn).detourKm
  );

  return detours.length === 1
    ? detours[0]
    : sql<number>`least(${sql.join(detours, sql`, `)})`;
};

/**
 * How far along the whole path the nearest leg places an endpoint, in km.
 *
 * The nearest leg decides, so this is an argmin rather than a `least`. A
 * correlated subquery over the legs says that in one pass; spelling it as a
 * nested `CASE` would repeat the detour expression once per leg per leg.
 */
const pathProgressKmSql = (
  path: CorridorPath,
  latColumn: AnyColumn,
  lngColumn: AnyColumn
): SQL<number> => {
  const rows = path.segments.map((segment) => {
    const { detourKm, progressKm } = segmentTerms(
      segment,
      path.lngScale,
      latColumn,
      lngColumn
    );
    return sql`select ${detourKm} as d, ${progressKm} as g`;
  });

  if (rows.length === 1) {
    return segmentTerms(path.segments[0], path.lngScale, latColumn, lngColumn)
      .progressKm;
  }

  return sql<number>`(
    select leg.g from (${sql.join(rows, sql` union all `)}) as leg
    order by leg.d limit 1
  )`;
};

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
    // corridor, its absence a radius (board_route_search_spec.md §2). Étapes
    // ride on the arrival — waypoints with nowhere to go describe no path.
    const hasOrigin =
      filters.fromLat !== undefined &&
      filters.fromLng !== undefined &&
      filters.radiusKm !== undefined;

    const path =
      hasOrigin && filters.toLat !== undefined && filters.toLng !== undefined
        ? corridorPath([
            { lat: filters.fromLat!, lng: filters.fromLng! },
            ...((filters.via ?? []) as LatLng[]),
            { lat: filters.toLat!, lng: filters.toLng! },
          ])
        : null;

    /** Distance from the driver, however they described where they are going. */
    const proximityKm = path
      ? pathDetourKmSql(path, listings.pickupLat, listings.pickupLng)
      : hasOrigin
        ? distanceKmSql(filters.fromLat!, filters.fromLng!)
        : null;

    if (path) {
      // Both ends inside the corridor, and the load travelling the driver's
      // way: Bordeaux → Paris is offered Angoulême → Orléans, never the
      // reverse.
      conditions.push(
        lte(proximityKm!, filters.radiusKm!),
        lte(
          pathDetourKmSql(path, listings.dropoffLat, listings.dropoffLng),
          filters.radiusKm!
        ),
        lte(
          pathProgressKmSql(path, listings.pickupLat, listings.pickupLng),
          pathProgressKmSql(path, listings.dropoffLat, listings.dropoffLng)
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
