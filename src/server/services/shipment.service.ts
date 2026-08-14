import { nanoid } from "nanoid";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { notificationsService } from "@/server/services/notifications.service";
import {
  expedionBridgeService,
  notifyExpedion,
} from "@/server/services/expedion-bridge.service";
import { paymentsService } from "@/server/services/payments.service";
import type {
  ShipmentStatusType,
  ActorRoleType,
} from "@/db/schema/shipments";

// ========================================
// Errors
// ========================================

export class ShipmentError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ShipmentError";
  }
}

const err = (code: string, status: number) => new ShipmentError(code, status);

// ========================================
// State machine
// ========================================

const TRANSITIONS: Record<ShipmentStatusType, ShipmentStatusType[]> = {
  PENDING: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

/** Once goods are moving, only the delivery outcome remains. */
const canTransition = (from: ShipmentStatusType, to: ShipmentStatusType) =>
  TRANSITIONS[from].includes(to);

// ========================================
// Viewer resolution
// ========================================

export interface Viewer {
  userId: string;
  isAdmin?: boolean;
  isOperator?: boolean;
}

type Party = "shipper" | "carrier" | "driver" | "staff" | "none";

function partyFor(
  ownership: { shipperId: string; carrierId: string; driverId: string | null },
  viewer: Viewer
): Party {
  if (ownership.shipperId === viewer.userId) return "shipper";
  if (ownership.carrierId === viewer.userId) return "carrier";
  if (ownership.driverId === viewer.userId) return "driver";
  if (viewer.isAdmin || viewer.isOperator) return "staff";
  return "none";
}

/**
 * The cargo facts the driver screen renders (driver/shipments/[id]). Anything
 * outside this list - `budgetCents` above all - stays server-side.
 */
const DRIVER_LISTING_FIELDS = [
  "id",
  "title",
  "description",
  "status",
  "weightKg",
  "lengthCm",
  "widthCm",
  "heightCm",
  "quantity",
  "isFragile",
  "needsHelp",
] as const;

/** A party reduced to what an avatar and a name need, nothing more. */
const DRIVER_PARTY_FIELDS = ["id", "name", "image"] as const;

/** Allow-list projection: unknown and future columns are dropped by default. */
function project<K extends string>(
  value: unknown,
  fields: readonly K[]
): Record<K, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(fields.map((f) => [f, source[f]])) as Record<
    K,
    unknown
  >;
}

/**
 * A driver executes the run and is never shown the commercial terms
 * (docs/specs/roles_spec.md §3). Stripping happens here rather than in the UI,
 * because hiding a field in a component still ships it over the wire.
 *
 * The DAL loads each party as a full user row (it is permission-blind by
 * design), so the relations are projected down as well: an unprojected
 * `shipper` carries the email, the Stripe ids, the ban flag and the
 * preferences JSON, and an unprojected `listing` carries `budgetCents`.
 */
function redactForDriver<T extends Record<string, unknown>>(
  shipment: T,
  party: Party
): T | Record<string, unknown> {
  if (party !== "driver") return shipment;
  const { priceCents, offer, listing, shipper, carrier, driver, ...safe } =
    shipment as Record<string, unknown>;
  void priceCents;
  void offer;

  return {
    ...safe,
    listing: project(listing, DRIVER_LISTING_FIELDS),
    shipper: project(shipper, DRIVER_PARTY_FIELDS),
    carrier: project(carrier, DRIVER_PARTY_FIELDS),
    driver: project(driver, DRIVER_PARTY_FIELDS),
  };
}

// ========================================
// Service
// ========================================

export const shipmentService = {
  async getShipmentDetail(shipmentId: string, viewer: Viewer) {
    const shipment = await shipmentsDal.getById(shipmentId);
    if (!shipment) throw err("SHIPMENT_NOT_FOUND", 404);

    const party = partyFor(shipment, viewer);
    if (party === "none") throw err("FORBIDDEN", 403);

    return redactForDriver(shipment, party);
  },

  async getUserShipments(
    viewer: Viewer,
    filters: { status?: ShipmentStatusType[]; page: number; limit: number }
  ) {
    const { items, total } = await shipmentsDal.getForUser(
      viewer.userId,
      filters
    );

    return {
      items: items.map((s) => redactForDriver(s, partyFor(s, viewer))),
      total,
      page: filters.page,
      limit: filters.limit,
    };
  },

  /** The carrier nominates one of its own drivers. */
  async assignDriver(shipmentId: string, driverId: string, viewer: Viewer) {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);

    const party = partyFor(ownership, viewer);
    if (party !== "carrier" && party !== "staff") throw err("FORBIDDEN", 403);

    if (!canTransition(ownership.status, "ASSIGNED")) {
      throw err("INVALID_STATUS_TRANSITION", 409);
    }

    // The driver must actually work for this carrier.
    const link = await carriersDal.getDriverLink(driverId);
    const carrier = await carriersDal.getByUserId(ownership.carrierId);
    if (!link || !carrier || link.carrierId !== carrier.id) {
      throw err("DRIVER_NOT_IN_FLEET", 403);
    }

    const updated = await shipmentsDal.assignDriver(shipmentId, driverId);
    await this.recordEvent(
      shipmentId,
      "ASSIGNED",
      ownership.status,
      viewer,
      "carrier"
    );

    await notify(driverId, "shipment_assigned", "New delivery assigned", shipmentId);
    reportToExpedion(ownership.listingId, "ASSIGNED");

    return updated;
  },

  /**
   * Advance the run. Delivery is the point at which the held payment becomes
   * capturable - the capture itself is triggered by the payments service.
   */
  async updateStatus(
    shipmentId: string,
    next: ShipmentStatusType,
    viewer: Viewer,
    note?: string
  ) {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);

    const party = partyFor(ownership, viewer);
    if (!["carrier", "driver", "staff"].includes(party)) {
      throw err("FORBIDDEN", 403);
    }

    if (!canTransition(ownership.status, next)) {
      throw err("INVALID_STATUS_TRANSITION", 409);
    }

    const updated = await shipmentsDal.updateStatus(shipmentId, next);
    await this.recordEvent(shipmentId, next, ownership.status, viewer, party, note);

    if (next === "DELIVERED") {
      await listingsDal.update(ownership.listingId, { status: "completed" });
      await settleDelivery(shipmentId, ownership.carrierId);
    }

    await notify(
      ownership.shipperId,
      "shipment_update",
      `Delivery ${next.toLowerCase().replace("_", " ")}`,
      shipmentId
    );
    reportToExpedion(ownership.listingId, next);

    return updated;
  },

  /** Proof of delivery both closes the run and evidences it for disputes. */
  async uploadProofOfDelivery(shipmentId: string, url: string, viewer: Viewer) {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);

    const party = partyFor(ownership, viewer);
    if (!["carrier", "driver", "staff"].includes(party)) {
      throw err("FORBIDDEN", 403);
    }

    if (ownership.status !== "IN_TRANSIT") {
      throw err("CANNOT_UPLOAD_POD", 409);
    }

    const updated = await shipmentsDal.updateProofOfDelivery(shipmentId, url);
    await this.recordEvent(
      shipmentId,
      "DELIVERED",
      ownership.status,
      viewer,
      party
    );
    await listingsDal.update(ownership.listingId, { status: "completed" });
    await settleDelivery(shipmentId, ownership.carrierId);

    await notify(
      ownership.shipperId,
      "shipment_update",
      "Delivered - proof of delivery available",
      shipmentId
    );
    reportToExpedion(ownership.listingId, "DELIVERED");

    return updated;
  },

  async cancelShipment(shipmentId: string, reason: string, viewer: Viewer) {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);

    const party = partyFor(ownership, viewer);
    if (party === "none") throw err("FORBIDDEN", 403);

    // Once the goods are on a vehicle, cancelling is a support matter.
    if (
      ["PICKED_UP", "IN_TRANSIT"].includes(ownership.status) &&
      party !== "staff"
    ) {
      throw err("CANCEL_REQUIRES_SUPPORT", 409);
    }
    if (!canTransition(ownership.status, "CANCELLED")) {
      throw err("INVALID_STATUS_TRANSITION", 409);
    }

    // The money was only ever held, so cancelling releases it rather than
    // refunding a charge that never completed.
    await paymentsService
      .releaseForShipment(shipmentId)
      .catch((e) => console.error("payment release failed", e));

    const updated = await shipmentsDal.cancel(shipmentId, reason);
    await this.recordEvent(
      shipmentId,
      "CANCELLED",
      ownership.status,
      viewer,
      party,
      reason
    );
    await listingsDal.update(ownership.listingId, { status: "cancelled" });
    reportToExpedion(ownership.listingId, "CANCELLED");

    return updated;
  },

  async getEvents(shipmentId: string, viewer: Viewer) {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);
    if (partyFor(ownership, viewer) === "none") throw err("FORBIDDEN", 403);

    return await shipmentsDal.getEvents(shipmentId);
  },

  async recordEvent(
    shipmentId: string,
    status: ShipmentStatusType,
    previousStatus: ShipmentStatusType,
    viewer: Viewer,
    party: Party,
    note?: string
  ) {
    const actorRole: ActorRoleType =
      party === "staff" ? "admin" : (party as ActorRoleType);

    return await shipmentsDal.createEvent({
      id: nanoid(),
      shipmentId,
      status,
      previousStatus,
      actorId: viewer.userId,
      actorRole,
      note: note ?? null,
    });
  },
};

async function notify(
  userId: string,
  type: string,
  title: string,
  shipmentId: string
) {
  await notificationsService
    .createNotification({
      userId,
      type,
      title,
      message: title,
      linkUrl: `/deliveries/${shipmentId}`,
      data: { shipmentId },
    })
    .catch((e) => console.error(`${type} notification failed`, e));
}

/**
 * Delivery is the moment the held funds become the platform's to take, and the
 * moment the carrier is owed. Both are recorded here rather than left to a
 * webhook, so a delivery is never marked complete with the money unaccounted
 * for.
 *
 * Failures are logged rather than thrown: the goods genuinely arrived, and
 * refusing to record that because Stripe was briefly unreachable would be
 * worse than a payment that needs re-running.
 */
async function settleDelivery(shipmentId: string, carrierId: string) {
  try {
    await paymentsService.captureForShipment(shipmentId);
    await paymentsService.schedulePayout(shipmentId, carrierId);
  } catch (error) {
    console.error(`Settlement failed for shipment ${shipmentId}`, error);
  }
}

/**
 * Mirrors a shipment's progress back to Expedion when the job came from there,
 * so the original client sees "retrait en cours" without leaving their app
 * (ROADMAP.md §3).
 *
 * Fire-and-forget: a bridge outage must never undo a delivery that actually
 * happened. No-op for direct listings.
 */
function reportToExpedion(listingId: string, shipmentStatus: string): void {
  notifyExpedion(
    expedionBridgeService.onShipmentStatus({ listingId, shipmentStatus })
  );
}
