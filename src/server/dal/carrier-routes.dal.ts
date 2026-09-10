import { nanoid } from "nanoid";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  carrierRoutes,
  carrierRouteDates,
  type InsertCarrierRoute,
} from "@/db/schema/carrier-routes";
import { carriers } from "@/db/schema/carriers";
import { user } from "@/db/schema/users";
import { KM_PER_DEGREE, type LatLng } from "@/lib/route-corridor";

// ========================================
// Carrier Routes DAL
// ========================================
// Permission-blind by rule (docs/rules.md §3.3). Ownership is decided in
// carrier-routes.service.ts; nothing here checks who is asking.
//
// `findMatchCandidates` is the one read here that crosses carriers, and its
// gate lives in carrier-discovery.service.ts.

type RouteColumns = Omit<
  InsertCarrierRoute,
  "id" | "createdAt" | "updatedAt"
>;

const withRelations = {
  dates: { orderBy: asc(carrierRouteDates.date) },
  vehicle: true,
} as const;

/** Dates arrive as a set: the caller replaces them wholesale or not at all. */
async function replaceDates(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  routeId: string,
  dates: Date[]
) {
  await tx
    .delete(carrierRouteDates)
    .where(eq(carrierRouteDates.routeId, routeId));

  if (dates.length === 0) return;

  await tx.insert(carrierRouteDates).values(
    dates.map((date) => ({
      id: nanoid(),
      routeId,
      date,
    }))
  );
}

// ========================================
// Reverse match prefilter
// ========================================
// The cheap half of "which carriers drive along this job": bounding boxes,
// flags, capacity and stored dates, with no trig per row and no sqrt. It may
// narrow the candidate set and may never decide a match — `matchRoute` in
// src/lib/route-match.ts is the predicate (carriers_on_route_spec.md §3.6).

/** The job, as the prefilter reads it. */
export interface MatchCandidateQuery {
  pickup: LatLng;
  dropoff: LatLng;
  weightKg: number;
  /** Start of the day the pickup window opens, or of today when that is later. */
  windowStart: Date;
  /** The window's close, `listings.pickup_until`. */
  windowEnd: Date;
}

/**
 * A computed constant, pinned to a floating-point type.
 *
 * Copied from `listings.dal.ts`, which carries the post-mortem: each of these
 * reaches Postgres as a bind parameter whose type is inferred from its
 * surroundings, and the integer column beside it was enough to infer *integer*
 * for the whole expression — so a fractional pad arrived as "invalid input
 * syntax for type integer" and the board 500'd. Stating the type removes the
 * inference.
 */
const real = (value: number): SQL<number> =>
  sql<number>`${value}::double precision`;

/**
 * Is this point inside the trajet's bounding box, padded by that trajet's own
 * `radius_km`?
 *
 * The necessary condition of the corridor test: a point within R km of the
 * segment (o,d) lies inside bbox(o,d) grown by R. Latitude scales at exactly
 * `KM_PER_DEGREE`, so that pad is exact.
 *
 * Longitude does not. `corridorPath` projects it at the trajet's **mean**
 * latitude, so a pad computed at any other latitude can come out smaller than
 * the one the predicate will apply — and a prefilter that is too tight drops a
 * genuine match, which is the one thing it may not do (spec §3.6). Over a
 * Lille → Marseille trajet, scaling at a Marseille pickup instead of the mean
 * makes the box 6% too narrow. Scaling at the endpoint furthest from the
 * equator takes the smallest cosine, hence the widest pad, hence a bound that
 * is never tighter than the predicate's — at the cost of one `cos` per row,
 * which is the right trade for an answer that cannot be wrong.
 */
const withinPaddedBox = (point: LatLng): SQL => {
  const latPad = sql`(${carrierRoutes.radiusKm} / ${real(KM_PER_DEGREE)})`;
  // Floored so a degenerate latitude cannot divide by zero.
  const lngScale = sql`greatest(${real(KM_PER_DEGREE)} * cos(radians(greatest(
    abs(${carrierRoutes.originLat}), abs(${carrierRoutes.destinationLat})
  ))), ${real(1)})`;
  const lngPad = sql`(${carrierRoutes.radiusKm} / ${lngScale})`;

  return sql`(
    ${real(point.lat)} between
      least(${carrierRoutes.originLat}, ${carrierRoutes.destinationLat}) - ${latPad}
      and greatest(${carrierRoutes.originLat}, ${carrierRoutes.destinationLat}) + ${latPad}
    and ${real(point.lng)} between
      least(${carrierRoutes.originLng}, ${carrierRoutes.destinationLng}) - ${lngPad}
      and greatest(${carrierRoutes.originLng}, ${carrierRoutes.destinationLng}) + ${lngPad}
  )`;
};

const matchCandidateWhere = (job: MatchCandidateQuery) =>
  and(
    eq(carrierRoutes.isActive, true),
    eq(carrierRoutes.isDiscoverable, true),
    eq(carriers.status, "approved"),
    eq(user.banned, false),
    // A trajet that declares no capacity is not excluded (spec §3.4).
    or(
      isNull(carrierRoutes.capacityKg),
      gte(carrierRoutes.capacityKg, job.weightKg)
    ),
    // A recurring trajet's runs are computed from `days_of_week`, which SQL
    // cannot walk, so it is admitted and decided in TypeScript. An occasional
    // one has to hold a stored date inside the window to be worth reading.
    or(
      eq(carrierRoutes.kind, "recurring"),
      exists(
        db
          .select({ one: sql`1` })
          .from(carrierRouteDates)
          .where(
            and(
              eq(carrierRouteDates.routeId, carrierRoutes.id),
              gte(carrierRouteDates.date, job.windowStart),
              lte(carrierRouteDates.date, job.windowEnd)
            )
          )
      )
    ),
    withinPaddedBox(job.pickup),
    withinPaddedBox(job.dropoff)
  );

/**
 * Enough for `matchRoute` to decide and for the DTO to project, and no more:
 * no address, no postal code, no vehicle row. The trajet's two cities are the
 * most a requester ever learns of it (carriers_on_route_spec.md §4.3).
 */
const matchCandidateColumns = {
  routeId: carrierRoutes.id,
  carrierId: carrierRoutes.carrierId,
  userId: carriers.userId,
  userName: user.name,
  userImage: user.image,
  averageRating: carriers.averageRating,
  totalRatings: carriers.totalRatings,
  // Free text the carrier typed at KYC, and optional — most rows are null.
  // It is the honest half of the Particuliers/Professionnels ask (§4.4): shown
  // when declared, absent when not, never guessed. The DTO bounds its length,
  // because nothing has ever validated what goes in here.
  legalForm: carriers.legalForm,
  kind: carrierRoutes.kind,
  daysOfWeek: carrierRoutes.daysOfWeek,
  validFrom: carrierRoutes.validFrom,
  validUntil: carrierRoutes.validUntil,
  originCity: carrierRoutes.originCity,
  originLat: carrierRoutes.originLat,
  originLng: carrierRoutes.originLng,
  destinationCity: carrierRoutes.destinationCity,
  destinationLat: carrierRoutes.destinationLat,
  destinationLng: carrierRoutes.destinationLng,
  radiusKm: carrierRoutes.radiusKm,
  capacityKg: carrierRoutes.capacityKg,
} as const;

/**
 * The stored dates `matchRoute` reads off `dates`.
 *
 * Only occasional trajets are fetched: a recurring one stores none — the DTO
 * refuses them — so asking for them would be up to sixty rows per candidate of
 * guaranteed nothing.
 */
async function attachDates<T extends { routeId: string; kind: string }>(
  rows: T[]
): Promise<(T & { dates: { date: Date }[] })[]> {
  const ids = rows
    .filter((row) => row.kind === "occasional")
    .map((row) => row.routeId);

  if (ids.length === 0) return rows.map((row) => ({ ...row, dates: [] }));

  const stored = await db
    .select({
      routeId: carrierRouteDates.routeId,
      date: carrierRouteDates.date,
    })
    .from(carrierRouteDates)
    .where(inArray(carrierRouteDates.routeId, ids))
    .orderBy(asc(carrierRouteDates.date));

  const byRoute = new Map<string, { date: Date }[]>();
  for (const row of stored) {
    const existing = byRoute.get(row.routeId);
    if (existing) existing.push({ date: row.date });
    else byRoute.set(row.routeId, [{ date: row.date }]);
  }

  return rows.map((row) => ({ ...row, dates: byRoute.get(row.routeId) ?? [] }));
}

export const carrierRoutesDal = {
  async listByCarrier(carrierId: string) {
    return await db.query.carrierRoutes.findMany({
      where: eq(carrierRoutes.carrierId, carrierId),
      with: withRelations,
      orderBy: desc(carrierRoutes.createdAt),
    });
  },

  async countByCarrier(carrierId: string) {
    const rows = await db
      .select({ id: carrierRoutes.id })
      .from(carrierRoutes)
      .where(eq(carrierRoutes.carrierId, carrierId));

    return rows.length;
  },

  /**
   * Scoped to the carrier on purpose: a route that is not theirs comes back
   * undefined, so the service can answer "not found" without ever having to
   * decide between 403 and 404 (carrier_trips_spec.md §5).
   */
  async getOwned(routeId: string, carrierId: string) {
    return await db.query.carrierRoutes.findFirst({
      where: and(
        eq(carrierRoutes.id, routeId),
        eq(carrierRoutes.carrierId, carrierId)
      ),
      with: withRelations,
    });
  },

  async create(values: RouteColumns, dates: Date[]) {
    const id = nanoid();

    await db.transaction(async (tx) => {
      await tx.insert(carrierRoutes).values({ id, ...values });
      await replaceDates(tx, id, dates);
    });

    return await db.query.carrierRoutes.findFirst({
      where: eq(carrierRoutes.id, id),
      with: withRelations,
    });
  },

  /** `dates` of `undefined` leaves the stored set alone; `[]` clears it. */
  async update(
    routeId: string,
    values: Partial<RouteColumns>,
    dates?: Date[]
  ) {
    await db.transaction(async (tx) => {
      if (Object.keys(values).length > 0) {
        await tx
          .update(carrierRoutes)
          .set(values)
          .where(eq(carrierRoutes.id, routeId));
      }

      if (dates !== undefined) {
        await replaceDates(tx, routeId, dates);
      }
    });

    return await db.query.carrierRoutes.findFirst({
      where: eq(carrierRoutes.id, routeId),
      with: withRelations,
    });
  },

  async remove(routeId: string) {
    await db.delete(carrierRoutes).where(eq(carrierRoutes.id, routeId));
    return { id: routeId };
  },

  /**
   * Trajets that might cover this job, across every carrier.
   *
   * The one read in this file not scoped to a single carrier, and the reason
   * the header above names carrier-discovery.service.ts: nothing here asks who
   * is calling. Capped by the caller, and generous on purpose — a row the
   * prefilter admits and `matchRoute` then rejects costs a comparison, while
   * one it wrongly excludes is a carrier the requester never sees.
   */
  async findMatchCandidates(job: MatchCandidateQuery, limit: number) {
    const rows = await db
      .select(matchCandidateColumns)
      .from(carrierRoutes)
      .innerJoin(carriers, eq(carriers.id, carrierRoutes.carrierId))
      .innerJoin(user, eq(user.id, carriers.userId))
      .where(matchCandidateWhere(job))
      .limit(limit);

    return await attachDates(rows);
  },
};

export type CarrierRouteRow = NonNullable<
  Awaited<ReturnType<typeof carrierRoutesDal.getOwned>>
>;

/** One prefilter candidate, in the shape `matchRoute` reads. */
export type MatchCandidateRow = Awaited<
  ReturnType<typeof carrierRoutesDal.findMatchCandidates>
>[number];
