import { db } from "@/db";
import {
  shipments,
  shipmentEvents,
  type InsertShipment,
  type InsertShipmentEvent,
  type ShipmentStatusType,
  type ActorRoleType,
} from "@/db/schema/shipments";
import { and, desc, eq, inArray, or, sql, count } from "drizzle-orm";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Shipments are created by the offer-acceptance transaction
 * (offers.service.ts), so there is no public "create from scratch" path here -
 * a shipment without a winning offer would have no agreed price.
 */
const withParties = {
  listing: true,
  offer: true,
  shipper: true,
  carrier: true,
  driver: true,
} as const;

export const shipmentsDal = {
  async create(data: InsertShipment, tx: Executor = db) {
    const [result] = await tx.insert(shipments).values(data).returning();
    return result;
  },

  async getById(id: string, tx: Executor = db) {
    return await tx.query.shipments.findFirst({
      where: eq(shipments.id, id),
      with: { ...withParties, events: true },
    });
  },

  async getByOfferId(offerId: string, tx: Executor = db) {
    return await tx.query.shipments.findFirst({
      where: eq(shipments.offerId, offerId),
    });
  },

  async getByListingId(listingId: string, tx: Executor = db) {
    return await tx.query.shipments.findFirst({
      where: eq(shipments.listingId, listingId),
      with: withParties,
    });
  },

  /**
   * Every shipment a user can see, in whichever capacity they hold. A user may
   * be shipper on one job and carrier on another, so the roles are OR'd rather
   * than branched on.
   */
  async getForUser(
    userId: string,
    filters: { status?: ShipmentStatusType[]; page: number; limit: number },
    tx: Executor = db
  ) {
    const conditions = [
      or(
        eq(shipments.shipperId, userId),
        eq(shipments.carrierId, userId),
        eq(shipments.driverId, userId)
      ),
    ];
    if (filters.status?.length) {
      conditions.push(inArray(shipments.status, filters.status));
    }

    const where = and(...conditions);

    const items = await tx.query.shipments.findMany({
      where,
      with: withParties,
      orderBy: [desc(shipments.createdAt)],
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
    });

    const [totals] = await tx
      .select({ total: count(shipments.id) })
      .from(shipments)
      .where(where);

    return { items, total: Number(totals?.total ?? 0) };
  },

  async getByShipperId(shipperId: string, tx: Executor = db) {
    return await tx.query.shipments.findMany({
      where: eq(shipments.shipperId, shipperId),
      with: withParties,
      orderBy: [desc(shipments.createdAt)],
    });
  },

  async getByCarrierId(carrierId: string, tx: Executor = db) {
    return await tx.query.shipments.findMany({
      where: eq(shipments.carrierId, carrierId),
      with: withParties,
      orderBy: [desc(shipments.createdAt)],
    });
  },

  async getByDriverId(driverId: string, tx: Executor = db) {
    return await tx.query.shipments.findMany({
      where: eq(shipments.driverId, driverId),
      with: withParties,
      orderBy: [desc(shipments.createdAt)],
    });
  },

  /** The three party ids, for permission checks without loading the graph. */
  async getOwnership(id: string, tx: Executor = db) {
    const [row] = await tx
      .select({
        id: shipments.id,
        shipperId: shipments.shipperId,
        carrierId: shipments.carrierId,
        driverId: shipments.driverId,
        status: shipments.status,
        listingId: shipments.listingId,
      })
      .from(shipments)
      .where(eq(shipments.id, id));
    return row;
  },

  async updateStatus(
    id: string,
    status: ShipmentStatusType,
    tx: Executor = db
  ) {
    const timestamps: Partial<InsertShipment> = {};
    if (status === "PICKED_UP") timestamps.pickedUpAt = new Date();
    if (status === "DELIVERED") timestamps.deliveredAt = new Date();
    if (status === "CANCELLED") timestamps.cancelledAt = new Date();

    const [result] = await tx
      .update(shipments)
      .set({ status, ...timestamps, updatedAt: new Date() })
      .where(eq(shipments.id, id))
      .returning();
    return result;
  },

  /** The carrier nominates one of its drivers to run the job. */
  async assignDriver(id: string, driverId: string, tx: Executor = db) {
    const [result] = await tx
      .update(shipments)
      .set({ driverId, status: "ASSIGNED", updatedAt: new Date() })
      .where(eq(shipments.id, id))
      .returning();
    return result;
  },

  async cancel(id: string, reason: string, tx: Executor = db) {
    const [result] = await tx
      .update(shipments)
      .set({
        status: "CANCELLED",
        cancellationReason: reason,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shipments.id, id))
      .returning();
    return result;
  },

  async updateProofOfDelivery(id: string, url: string, tx: Executor = db) {
    const [result] = await tx
      .update(shipments)
      .set({
        proofOfDeliveryUrl: url,
        status: "DELIVERED",
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shipments.id, id))
      .returning();
    return result;
  },

  // ---- Timeline ----

  async createEvent(data: InsertShipmentEvent, tx: Executor = db) {
    const [result] = await tx.insert(shipmentEvents).values(data).returning();
    return result;
  },

  async getEvents(shipmentId: string, tx: Executor = db) {
    return await tx.query.shipmentEvents.findMany({
      where: eq(shipmentEvents.shipmentId, shipmentId),
      with: { actor: true },
      orderBy: [desc(shipmentEvents.createdAt)],
    });
  },

  // ---- Admin ----

  async listAll(
    filters: { status?: ShipmentStatusType; page: number; limit: number },
    tx: Executor = db
  ) {
    const where = filters.status
      ? eq(shipments.status, filters.status)
      : undefined;

    const items = await tx.query.shipments.findMany({
      where,
      with: withParties,
      orderBy: [desc(shipments.createdAt)],
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
    });

    const [totals] = await tx
      .select({ total: count(shipments.id) })
      .from(shipments)
      .where(where);

    return { items, total: Number(totals?.total ?? 0) };
  },

  async countByStatus(tx: Executor = db) {
    return await tx
      .select({ status: shipments.status, total: count(shipments.id) })
      .from(shipments)
      .groupBy(shipments.status);
  },

  async sumCompletedValue(tx: Executor = db) {
    const [row] = await tx
      .select({ total: sql<number>`COALESCE(SUM(${shipments.priceCents}), 0)` })
      .from(shipments)
      .where(eq(shipments.status, "DELIVERED"));
    return Number(row?.total ?? 0);
  },
};

export type { ActorRoleType };
