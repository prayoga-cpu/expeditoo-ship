import { db } from "@/db";
import {
  shipmentIncidents,
  shipments,
  type InsertShipmentIncident,
  type ShipmentIncident,
  type ShipmentIncidentStatus,
} from "@/db/schema/shipments";
import { user } from "@/db/schema/users";
import { desc, eq, sql } from "drizzle-orm";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Permission-blind, like every DAL here (docs/rules.md §1.4). Whether a caller
 * may see an incident is `shipmentIncidentsService`'s question; this module
 * only knows how to read and write rows.
 */

/** An incident plus the reporter's display name, which every surface prints. */
export interface IncidentWithReporter {
  incident: ShipmentIncident;
  reporterName: string | null;
}

/** The queue also needs to say which run each row belongs to. */
export interface QueuedIncident extends IncidentWithReporter {
  shipmentTitle: string | null;
}

export const shipmentIncidentsDal = {
  async create(data: InsertShipmentIncident, tx: Executor = db) {
    const [result] = await tx
      .insert(shipmentIncidents)
      .values(data)
      .returning();
    return result;
  },

  async getById(id: string, tx: Executor = db) {
    const [row] = await tx
      .select()
      .from(shipmentIncidents)
      .where(eq(shipmentIncidents.id, id));
    return row;
  },

  /** Newest first: on a run in trouble, the latest report is the live one. */
  async listForShipment(
    shipmentId: string,
    tx: Executor = db
  ): Promise<IncidentWithReporter[]> {
    const rows = await tx
      .select({ incident: shipmentIncidents, reporterName: user.name })
      .from(shipmentIncidents)
      .leftJoin(user, eq(user.id, shipmentIncidents.reportedByUserId))
      .where(eq(shipmentIncidents.shipmentId, shipmentId))
      .orderBy(desc(shipmentIncidents.createdAt));

    return rows.map((row) => ({
      incident: row.incident,
      reporterName: row.reporterName,
    }));
  },

  /**
   * The operator queue.
   *
   * Ordered by severity before age so a lorry on fire outranks a late arrival
   * filed an hour earlier. Postgres orders an enum by declaration order, and
   * `shipment_incident_severity` is declared low → high, so `high` sorts last
   * ascending — hence the explicit CASE rather than `desc(severity)`, which
   * would silently put the calmest incidents on top.
   */
  async listQueue(
    status: ShipmentIncidentStatus | undefined,
    limit: number,
    offset: number,
    tx: Executor = db
  ): Promise<{ items: QueuedIncident[]; total: number }> {
    const where = status ? eq(shipmentIncidents.status, status) : undefined;

    const severityRank = sql`CASE ${shipmentIncidents.severity}
      WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`;

    const rows = await tx
      .select({
        incident: shipmentIncidents,
        reporterName: user.name,
        shipmentTitle: shipments.pickupAddress,
      })
      .from(shipmentIncidents)
      .leftJoin(user, eq(user.id, shipmentIncidents.reportedByUserId))
      .leftJoin(shipments, eq(shipments.id, shipmentIncidents.shipmentId))
      .where(where)
      .orderBy(severityRank, desc(shipmentIncidents.createdAt))
      .limit(limit)
      .offset(offset);

    const [counted] = await tx
      .select({ value: sql<number>`count(*)` })
      .from(shipmentIncidents)
      .where(where);

    return {
      items: rows.map((row) => ({
        incident: row.incident,
        reporterName: row.reporterName,
        shipmentTitle: row.shipmentTitle,
      })),
      total: Number(counted?.value) || 0,
    };
  },

  async update(
    id: string,
    data: Partial<InsertShipmentIncident>,
    tx: Executor = db
  ) {
    const [result] = await tx
      .update(shipmentIncidents)
      .set(data)
      .where(eq(shipmentIncidents.id, id))
      .returning();
    return result;
  },
};
