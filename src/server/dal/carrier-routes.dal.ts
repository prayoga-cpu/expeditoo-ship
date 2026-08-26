import { nanoid } from "nanoid";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  carrierRoutes,
  carrierRouteDates,
  type InsertCarrierRoute,
} from "@/db/schema/carrier-routes";

// ========================================
// Carrier Routes DAL
// ========================================
// Permission-blind by rule (docs/rules.md §3.3). Ownership is decided in
// carrier-routes.service.ts; nothing here checks who is asking.

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
};

export type CarrierRouteRow = NonNullable<
  Awaited<ReturnType<typeof carrierRoutesDal.getOwned>>
>;
