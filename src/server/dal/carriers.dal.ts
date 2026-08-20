import { db } from "@/db";
import {
  carriers,
  carrierDocuments,
  vehicles,
  carrierDrivers,
  type InsertCarrier,
  type InsertCarrierDocument,
  type InsertCarrierDriver,
  type InsertVehicle,
  type CarrierStatus,
} from "@/db/schema/carriers";
import { and, desc, eq, lte } from "drizzle-orm";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const carriersDal = {
  async create(data: InsertCarrier, tx: Executor = db) {
    const [result] = await tx.insert(carriers).values(data).returning();
    return result;
  },

  async getByUserId(userId: string, tx: Executor = db) {
    return await tx.query.carriers.findFirst({
      where: eq(carriers.userId, userId),
      with: { documents: true, vehicles: true },
    });
  },

  async getById(id: string, tx: Executor = db) {
    return await tx.query.carriers.findFirst({
      where: eq(carriers.id, id),
      with: { documents: true, vehicles: true },
    });
  },

  async getBySiret(siret: string, tx: Executor = db) {
    return await tx.query.carriers.findFirst({
      where: eq(carriers.siret, siret),
    });
  },

  /** Omitting the status returns every application, newest first. */
  async listByStatus(status: CarrierStatus | undefined, tx: Executor = db) {
    return await tx.query.carriers.findMany({
      where: status ? eq(carriers.status, status) : undefined,
      with: { documents: true, vehicles: true, user: true },
      orderBy: desc(carriers.createdAt),
    });
  },

  async update(id: string, data: Partial<InsertCarrier>, tx: Executor = db) {
    const [result] = await tx
      .update(carriers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(carriers.id, id))
      .returning();
    return result;
  },

  // ---- Documents ----

  async upsertDocument(data: InsertCarrierDocument, tx: Executor = db) {
    const [result] = await tx
      .insert(carrierDocuments)
      .values(data)
      .onConflictDoUpdate({
        target: [carrierDocuments.carrierId, carrierDocuments.kind],
        set: {
          objectKey: data.objectKey,
          mimeType: data.mimeType,
          sizeBytes: data.sizeBytes,
          expiresAt: data.expiresAt,
          status: "pending",
          rejectionReason: null,
          uploadedAt: new Date(),
        },
      })
      .returning();
    return result;
  },

  async getDocumentById(id: string, tx: Executor = db) {
    return await tx.query.carrierDocuments.findFirst({
      where: eq(carrierDocuments.id, id),
    });
  },

  async listDocuments(carrierId: string, tx: Executor = db) {
    return await tx.query.carrierDocuments.findMany({
      where: eq(carrierDocuments.carrierId, carrierId),
    });
  },

  /** Drives the expiry reminder and auto-suspension cron. */
  async listDocumentsExpiringBefore(cutoff: Date, tx: Executor = db) {
    return await tx.query.carrierDocuments.findMany({
      where: lte(carrierDocuments.expiresAt, cutoff),
      with: { carrier: true },
    });
  },

  async setAllDocumentsAccepted(carrierId: string, tx: Executor = db) {
    await tx
      .update(carrierDocuments)
      .set({ status: "accepted", rejectionReason: null })
      .where(eq(carrierDocuments.carrierId, carrierId));
  },

  // ---- Vehicles ----

  async createVehicle(data: InsertVehicle, tx: Executor = db) {
    const [result] = await tx.insert(vehicles).values(data).returning();
    return result;
  },

  async getVehicleById(id: string, tx: Executor = db) {
    return await tx.query.vehicles.findFirst({
      where: eq(vehicles.id, id),
      with: { carrier: true },
    });
  },

  async listVehicles(carrierId: string, activeOnly = false, tx: Executor = db) {
    const conditions = [eq(vehicles.carrierId, carrierId)];
    if (activeOnly) conditions.push(eq(vehicles.isActive, true));

    return await tx.query.vehicles.findMany({ where: and(...conditions) });
  },

  async updateVehicle(
    id: string,
    data: Partial<InsertVehicle>,
    tx: Executor = db
  ) {
    const [result] = await tx
      .update(vehicles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();
    return result;
  },

  async deleteVehicle(id: string, tx: Executor = db) {
    await tx.delete(vehicles).where(eq(vehicles.id, id));
  },

  // ---- Drivers ----

  async listDrivers(carrierId: string, tx: Executor = db) {
    return await tx.query.carrierDrivers.findMany({
      where: eq(carrierDrivers.carrierId, carrierId),
      with: { user: true },
    });
  },

  /**
   * Idempotent fleet membership. Re-linking a driver the carrier had removed
   * reactivates the existing row rather than colliding with the
   * (carrier_id, user_id) unique constraint.
   */
  async upsertDriverLink(data: InsertCarrierDriver, tx: Executor = db) {
    const [result] = await tx
      .insert(carrierDrivers)
      .values(data)
      .onConflictDoUpdate({
        target: [carrierDrivers.carrierId, carrierDrivers.userId],
        set: {
          isActive: true,
          acceptedAt: data.acceptedAt ?? new Date(),
        },
      })
      .returning();
    return result;
  },

  async getDriverLink(userId: string, tx: Executor = db) {
    return await tx.query.carrierDrivers.findFirst({
      where: and(
        eq(carrierDrivers.userId, userId),
        eq(carrierDrivers.isActive, true)
      ),
      with: { carrier: true },
    });
  },
};
