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
import { invoicesService } from "@/server/services/invoices.service";
import { shipmentPhotosService } from "@/server/services/shipment-photos.service";
import {
  partyFor,
  shipmentErr,
  type Party,
  type Viewer,
} from "@/server/services/shipment-access";
import { shipmentConfirmationsService } from "@/server/services/shipment-confirmations.service";
import { confirmationUrl } from "@/lib/confirmation-token";
import type { ConfirmableMilestone } from "@/lib/confirmation-token";
import type {
  ShipmentStatusType,
  ShipmentPhotoStage,
  ActorRoleType,
} from "@/db/schema/shipments";

// ========================================
// Errors and party resolution
// ========================================
//
// Both live in `shipment-access.ts` so `shipment-photos.service.ts` can use
// them without importing this module - this one asks the photos service
// whether evidence exists before it will advance a run, and the two importing
// each other would close a cycle. Re-exported here so existing importers
// (`viewer.service`, `admin-nav.service`, `api-response`) are unaffected.

export { ShipmentError } from "./shipment-access";
export type { Viewer } from "./shipment-access";

const err = shipmentErr;

// ========================================
// State machine
// ========================================

/**
 * `IN_TRANSIT → CANCELLED` exists because support has always been promised it
 * and has never had it: `cancelShipment` exempted staff from
 * `CANCEL_REQUIRES_SUPPORT` and then hit this table four lines later, so an
 * operator ending a run on the road received `INVALID_STATUS_TRANSITION` while
 * the UI copy told the client to contact support.
 *
 * It is only safe because `updateStatus` now refuses `CANCELLED` outright
 * (§7): this table is shared, and the edge would otherwise hand every driver an
 * unrefunded mid-transit cancel.
 *
 * `DELIVERED` keeps no outgoing edge, deliberately. A payout row and an invoice
 * already exist by then and there is no clawback anywhere.
 */
const TRANSITIONS: Record<ShipmentStatusType, ShipmentStatusType[]> = {
  PENDING: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

/** Once goods are moving, only the delivery outcome remains. */
const canTransition = (from: ShipmentStatusType, to: ShipmentStatusType) =>
  TRANSITIONS[from].includes(to);

/**
 * The two moves that need evidence before they are allowed, and the stage that
 * evidences each - see shipment_photos_spec.md §3.6.
 *
 * `CANCELLED` is deliberately absent: a job being called off is the last thing
 * that should demand a photograph first. `PICKED_UP -> IN_TRANSIT` is absent
 * too, because nothing changes hands there.
 */
const PHOTO_GATED_TRANSITIONS: Partial<
  Record<ShipmentStatusType, { stage: ShipmentPhotoStage; code: string }>
> = {
  PICKED_UP: { stage: "pickup", code: "PICKUP_PHOTO_REQUIRED" },
  DELIVERED: { stage: "delivery", code: "DELIVERY_PHOTO_REQUIRED" },
};

/**
 * Applies to `staff` as well as the driver. An operator moving a stuck run is
 * exactly the case where the record most needs to say what was seen, and
 * support already has `shipmentCancellationService.cancelJob` for a run that
 * genuinely cannot go on.
 */
async function requirePhotoFor(shipmentId: string, next: ShipmentStatusType) {
  const gate = PHOTO_GATED_TRANSITIONS[next];
  if (!gate) return;

  if (!(await shipmentPhotosService.hasStagePhoto(shipmentId, gate.stage))) {
    throw err(gate.code, 409);
  }
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

/**
 * *That* the client confirmed is not a commercial fact, so a driver sees it.
 * *Who* they are is one they have no use for, so the two identity columns are
 * dropped (transport_status_confirmation_spec.md §9.4).
 */
const DRIVER_CONFIRMATION_FIELDS = [
  "id",
  "milestone",
  "channel",
  "confirmedByRole",
  "createdAt",
] as const;

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
  const {
    priceCents,
    offer,
    listing,
    shipper,
    carrier,
    driver,
    confirmations,
    ...safe
  } = shipment as Record<string, unknown>;
  void priceCents;
  void offer;

  return {
    ...safe,
    listing: project(listing, DRIVER_LISTING_FIELDS),
    shipper: project(shipper, DRIVER_PARTY_FIELDS),
    carrier: project(carrier, DRIVER_PARTY_FIELDS),
    driver: project(driver, DRIVER_PARTY_FIELDS),
    confirmations: Array.isArray(confirmations)
      ? confirmations.map((c) => project(c, DRIVER_CONFIRMATION_FIELDS))
      : [],
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
    reportToExpedion(ownership.listingId, "ASSIGNED", shipmentId);

    return updated;
  },

  /**
   * Advance the run. Delivery is the point at which the driver's share is
   * settled - the settlement itself is triggered by the payments service.
   *
   * This is **not** a way to cancel. It used to be: the status route accepted
   * `CANCELLED`, and this method would take it, writing `cancelled_at` with no
   * reason, no side, no refund and a listing left live — from `PICKED_UP`, where
   * the cancel endpoint itself refuses. The driver client's status union already
   * carried the value, so a cancel button wired to the wrong endpoint was one
   * line away (cancellations_spec.md §7).
   */
  async updateStatus(
    shipmentId: string,
    next: ShipmentStatusType,
    viewer: Viewer,
    note?: string
  ) {
    if (next === "CANCELLED") throw err("CANCEL_VIA_CANCEL_ENDPOINT", 409);

    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);

    const party = partyFor(ownership, viewer);
    if (!["carrier", "driver", "staff"].includes(party)) {
      throw err("FORBIDDEN", 403);
    }

    if (!canTransition(ownership.status, next)) {
      throw err("INVALID_STATUS_TRANSITION", 409);
    }

    // Before anything is written, and before any money moves: a delivery that
    // settles a payment and only then discovers it has no evidence is a
    // delivery that cannot be undone.
    await requirePhotoFor(shipmentId, next);

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
    reportToExpedion(ownership.listingId, next, shipmentId);
    requestClientConfirmation(shipmentId, next);

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
    const payment = await paymentsService.getForShipment(shipmentId);

    // The client paid at booking, so delivery takes nothing further from them
    // (docs/specs/payment_at_booking_spec.md §5). It settles the driver's half
    // and writes the paperwork, and both need money that actually arrived.
    if (payment?.status !== "captured") {
      console.error(
        `Settlement skipped for shipment ${shipmentId}: payment is ` +
          `${payment?.status ?? "missing"}, not captured`
      );
      return;
    }

    await paymentsService.schedulePayout(shipmentId, carrierId);

    // The paperwork, in its own try: an invoice that fails to write must not
    // strand a captured payment (billing_documents_spec.md §4.1). It is
    // idempotent on the payment, so the two delivery paths cannot mint two.
    //
    // This is now a backstop rather than the wire. The document is raised when
    // the money is taken, which is at booking (invoice_at_payment_spec.md §1);
    // what still reaches here is a payment captured before that shipped, and a
    // payment whose issue failed at the time. It returns null, quietly, for the
    // escalated lane and for money that never arrived.
    try {
      await invoicesService.createFromPayment(payment.id);
    } catch (error) {
      console.error(`Invoice creation failed for shipment ${shipmentId}`, error);
    }
  } catch (error) {
    console.error(`Settlement failed for shipment ${shipmentId}`, error);
  }
}

/**
 * Which confirmation link the bridge's SMS should carry for a given state.
 *
 * `IN_TRANSIT` maps to `PICKED_UP` as a backstop: the two collapse onto one
 * Expedion stage, so a quote that somehow missed the pickup write still gets
 * the right link. Sending twice is not a risk here — the bridge refuses to
 * re-report a status the quote already holds, so only the first of the pair
 * reaches the client.
 */
const LINK_FOR_STATE: Record<string, ConfirmableMilestone | undefined> = {
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "PICKED_UP",
  DELIVERED: "DELIVERED",
};

/**
 * Which milestone the *email* asks about, keyed on the state the run just
 * entered.
 *
 * Deliberately narrower than `LINK_FOR_STATE`: the email has no dedupe in
 * front of it, so mapping `IN_TRANSIT` onto `PICKED_UP` here would mail the
 * same client the same question twice for one pickup. `PICKED_UP` is always
 * passed through on the way to `IN_TRANSIT` (see `TRANSITIONS`), so nothing is
 * missed by leaving it out.
 */
const EMAIL_FOR_STATE: Record<string, ConfirmableMilestone | undefined> = {
  PICKED_UP: "PICKED_UP",
  DELIVERED: "DELIVERED",
};

/**
 * Mirrors a shipment's progress back to Expedion when the job came from there,
 * so the original client sees "retrait en cours" without leaving their app
 * (ROADMAP.md §3), and carries the client's confirmation link on the SMS the
 * bridge already sends.
 *
 * Fire-and-forget: a bridge outage must never undo a delivery that actually
 * happened. No-op for direct listings.
 */
function reportToExpedion(
  listingId: string,
  shipmentStatus: string,
  shipmentId: string
): void {
  const milestone = LINK_FOR_STATE[shipmentStatus];

  notifyExpedion(
    // The counts ride along so the Expedion tracking feed can say photos are
    // available without a second round trip to fetch and discard them.
    shipmentPhotosService.stageCounts(shipmentId).then((photoCounts) =>
      expedionBridgeService.onShipmentStatus({
        listingId,
        shipmentStatus,
        photoCounts,
        confirmUrl: milestone
          ? (confirmationUrl(shipmentId, milestone) ?? undefined)
          : undefined,
      })
    )
  );
}

/**
 * Ask the client to attest what the transporter just recorded.
 *
 * Logged rather than thrown, like every other downstream of a status change:
 * the run really did move, and refusing to record that because Resend was
 * briefly unreachable would be the worse failure.
 */
function requestClientConfirmation(
  shipmentId: string,
  shipmentStatus: string
): void {
  const milestone = EMAIL_FOR_STATE[shipmentStatus];
  if (!milestone) return;

  void shipmentConfirmationsService
    .requestConfirmation(shipmentId, milestone)
    .catch((error) =>
      console.error(
        `Confirmation request failed for shipment ${shipmentId}`,
        error
      )
    );
}
