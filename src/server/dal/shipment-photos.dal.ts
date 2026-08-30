import { db } from "@/db";
import {
  shipmentPhotos,
  type InsertShipmentPhoto,
  type ShipmentPhotoStage,
} from "@/db/schema/shipments";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Shipment photos are evidence, so this DAL has an insert, several reads and
 * exactly one write that is not an insert: the admin's soft delete. There is
 * no update of the image, the location or the timestamps — not guarded by a
 * permission check that could later be widened, but simply absent.
 *
 * "Live" throughout means `deleted_at IS NULL`. A soft-deleted photo is gone
 * from every listing and satisfies no transition gate, but its row and its R2
 * object both survive.
 */
const live = isNull(shipmentPhotos.deletedAt);

export const shipmentPhotosDal = {
  async create(data: InsertShipmentPhoto, tx: Executor = db) {
    const [result] = await tx.insert(shipmentPhotos).values(data).returning();
    return result;
  },

  /** Oldest first: the order they were taken is the order they are read in. */
  async listForShipment(shipmentId: string, tx: Executor = db) {
    return await tx
      .select()
      .from(shipmentPhotos)
      .where(and(eq(shipmentPhotos.shipmentId, shipmentId), live))
      .orderBy(asc(shipmentPhotos.recordedAt));
  },

  /**
   * Scoped to the shipment on purpose. The route has both ids, and looking up
   * by photo id alone would make "wrong shipment" a 200 for anyone who could
   * read any shipment.
   */
  async getForShipment(
    shipmentId: string,
    photoId: string,
    tx: Executor = db
  ) {
    const [row] = await tx
      .select()
      .from(shipmentPhotos)
      .where(
        and(
          eq(shipmentPhotos.id, photoId),
          eq(shipmentPhotos.shipmentId, shipmentId),
          live
        )
      );
    return row;
  },

  async countForStage(
    shipmentId: string,
    stage: ShipmentPhotoStage,
    tx: Executor = db
  ) {
    const [row] = await tx
      .select({ total: count(shipmentPhotos.id) })
      .from(shipmentPhotos)
      .where(
        and(
          eq(shipmentPhotos.shipmentId, shipmentId),
          eq(shipmentPhotos.stage, stage),
          live
        )
      );
    return Number(row?.total ?? 0);
  },

  /** One query for a list screen, rather than one per row. */
  async listForShipments(shipmentIds: string[], tx: Executor = db) {
    if (shipmentIds.length === 0) return [];
    return await tx
      .select()
      .from(shipmentPhotos)
      .where(and(inArray(shipmentPhotos.shipmentId, shipmentIds), live))
      .orderBy(asc(shipmentPhotos.recordedAt));
  },

  /**
   * The only non-insert write. Nothing is erased: the row keeps its key, its
   * location and its timestamps, and the object stays in the bucket.
   */
  async softDelete(
    photoId: string,
    deletedByUserId: string,
    reason: string,
    tx: Executor = db
  ) {
    const [result] = await tx
      .update(shipmentPhotos)
      .set({
        deletedAt: new Date(),
        deletedByUserId,
        deletionReason: reason,
      })
      .where(and(eq(shipmentPhotos.id, photoId), live))
      .returning();
    return result;
  },
};
