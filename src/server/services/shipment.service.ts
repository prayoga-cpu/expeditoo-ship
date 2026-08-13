import { nanoid } from "nanoid";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { notificationsService } from "@/server/services/notifications.service";
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
 * A driver executes the run and is never shown the commercial terms
 * (docs/specs/roles_spec.md §3). Stripping happens here rather than in the UI,
 * because hiding a field in a component still ships it over the wire.
 */
function redactForDriver<T extends Record<string, unknown>>(
  shipment: T,
  party: Party
): T {
  if (party !== "driver") return shipment;
  const { priceCents, offer, ...safe } = shipment as Record<string, unknown>;
  void priceCents;
  void offer;
  return safe as T;
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
    }

    await notify(
      ownership.shipperId,
      "shipment_update",
      `Delivery ${next.toLowerCase().replace("_", " ")}`,
      shipmentId
    );

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

    await notify(
      ownership.shipperId,
      "shipment_update",
      "Delivered - proof of delivery available",
      shipmentId
    );

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
