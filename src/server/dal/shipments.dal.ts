import { db } from "@/db";
import {
  shipments,
  shipmentEvents,
  shipmentConfirmations,
  shipmentPhotos,
  type InsertShipment,
  type InsertShipmentEvent,
  type InsertShipmentConfirmation,
  type ShipmentStatusType,
  type ActorRoleType,
  type ShipmentCancellationSide,
  type ShipmentCancellationCategory,
} from "@/db/schema/shipments";
import { and, desc, eq, inArray, or, sql, count } from "drizzle-orm";
import { user } from "@/db/schema/users";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Everything a cancellation records beyond the status itself. `byUserId` and
 * `byRef` are mutually exclusive: an Expedion quote owner has no `user` row, so
 * they arrive as a ref (cancellations_spec.md §3.3).
 */
export interface CancellationDetails {
  reason: string | null;
  side: ShipmentCancellationSide;
  category: ShipmentCancellationCategory;
  byUserId: string | null;
  byRef: string | null;
}

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
  /** The client's half of the timeline. Carried on every shipment query so no
   *  surface needs a second round trip to know whether the client signed off. */
  confirmations: true,
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

  /**
   * The **live** run for a job.
   *
   * A listing could only ever carry one shipment until withdrawal arrived:
   * an award created one, and cancelling killed the job with it. A transporter
   * handing the job back now leaves a `CANCELLED` row behind and the re-award
   * mints a second — so an unordered `findFirst` here would hand callers the
   * dead one about half the time, and `shipment_listing_idx` is not unique.
   *
   * Cancelled rows are only returned when there is nothing else, so a caller
   * asking about a job that was called off still gets told what happened rather
   * than nothing at all.
   */
  async getByListingId(listingId: string, tx: Executor = db) {
    const rows = await tx.query.shipments.findMany({
      where: eq(shipments.listingId, listingId),
      with: withParties,
      orderBy: [desc(shipments.createdAt)],
    });

    return rows.find((row) => row.status !== "CANCELLED") ?? rows[0];
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

  /**
   * The delivered runs behind a set of listings, for the requester's history
   * on `/listings/me` (my_requests_history_spec.md §4).
   *
   * `DELIVERED` is the predicate rather than `listings.status = 'completed'`:
   * the listing is closed by a second, non-transactional write after the
   * shipment transitions (`shipment.service.ts:253`, `:291`), so it can lag,
   * and only the shipment carries a delivery timestamp.
   *
   * The columns are named rather than loaded through `withParties`, which
   * returns whole `user` rows. `redactForDriver` narrows those only for a
   * driver viewer, which is why `GET /api/shipments` already hands a shipper
   * the carrier's email and Stripe ids. This query does not inherit that.
   *
   * The join to `user` is LEFT so a delivery survives a carrier whose row no
   * longer resolves - the same reasoning as `earnings.dal.ts`.
   */
  async listDeliveredForListings(listingIds: string[], tx: Executor = db) {
    if (listingIds.length === 0) return [];

    return await tx
      .select({
        listingId: shipments.listingId,
        shipmentId: shipments.id,
        deliveredAt: shipments.deliveredAt,
        priceCents: shipments.priceCents,
        /*
         * A marker, not the evidence. The photos live in a private bucket and
         * are read one at a time through an authorising route, so what a
         * history card needs is whether there is anything to open - and an
         * EXISTS is that answer without dragging six rows per shipment back.
         */
        hasDeliveryPhoto: sql<boolean>`EXISTS (
          SELECT 1 FROM ${shipmentPhotos}
          WHERE ${shipmentPhotos.shipmentId} = ${shipments.id}
            AND ${shipmentPhotos.stage} = 'delivery'
            AND ${shipmentPhotos.deletedAt} IS NULL
        )`,
        carrierId: user.id,
        carrierName: user.name,
        carrierImage: user.image,
        carrierRating: user.rating,
      })
      .from(shipments)
      .leftJoin(user, eq(user.id, shipments.carrierId))
      .where(
        and(
          inArray(shipments.listingId, listingIds),
          eq(shipments.status, "DELIVERED")
        )
      )
      .orderBy(desc(shipments.deliveredAt));
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
        // Which award this run belongs to. A listing can carry more than one
        // shipment now, so "is this the live run" is a question every write
        // path has to be able to ask.
        offerId: shipments.offerId,
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

  /**
   * Ends a run, recording which side ended it as part of the same UPDATE.
   *
   * The side used to survive only in the `shipment_events` row, which is a
   * separate insert that can fail after this one has landed — and which
   * collapses staff onto `admin`. Written here it cannot disagree with the row
   * it describes (cancellations_spec.md §3.3).
   */
  async cancel(id: string, details: CancellationDetails, tx: Executor = db) {
    const [result] = await tx
      .update(shipments)
      .set({
        status: "CANCELLED",
        cancellationReason: details.reason,
        cancelledBySide: details.side,
        cancellationCategory: details.category,
        cancelledByUserId: details.byUserId,
        cancelledByRef: details.byRef,
        cancelledAt: new Date(),
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

  // ---- Client confirmations ----

  /**
   * Insert unless the client has already confirmed this milestone.
   *
   * `onConflictDoNothing` against `shipment_confirmation_unique` returns an
   * empty array on a duplicate, which the service reads as "already confirmed"
   * and answers with the existing row. Doing it in one statement rather than
   * read-then-write means two links tapped at once cannot both insert.
   */
  async createConfirmation(
    data: InsertShipmentConfirmation,
    tx: Executor = db
  ) {
    const [result] = await tx
      .insert(shipmentConfirmations)
      .values(data)
      .onConflictDoNothing({
        target: [
          shipmentConfirmations.shipmentId,
          shipmentConfirmations.milestone,
        ],
      })
      .returning();
    return result ?? null;
  },

  async getConfirmation(
    shipmentId: string,
    milestone: ShipmentStatusType,
    tx: Executor = db
  ) {
    return await tx.query.shipmentConfirmations.findFirst({
      where: and(
        eq(shipmentConfirmations.shipmentId, shipmentId),
        eq(shipmentConfirmations.milestone, milestone)
      ),
    });
  },

  async getConfirmations(shipmentId: string, tx: Executor = db) {
    return await tx.query.shipmentConfirmations.findMany({
      where: eq(shipmentConfirmations.shipmentId, shipmentId),
      orderBy: [desc(shipmentConfirmations.createdAt)],
    });
  },

  /** One query for a list screen, rather than one per row. */
  async getConfirmationsForMany(shipmentIds: string[], tx: Executor = db) {
    if (shipmentIds.length === 0) return [];
    return await tx.query.shipmentConfirmations.findMany({
      where: inArray(shipmentConfirmations.shipmentId, shipmentIds),
      orderBy: [desc(shipmentConfirmations.createdAt)],
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
