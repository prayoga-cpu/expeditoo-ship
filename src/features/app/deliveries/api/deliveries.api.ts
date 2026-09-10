import { api, toQuery } from "@/lib/fetcher";
import type {
  CancellationCategory,
  CancellationSide,
} from "@/lib/cancellation-policy";

/**
 * Client API for the shipper-side tracking surface.
 *
 * Mirrors what the shipments REST layer actually returns: the shipment row
 * with its party relations (shipment.service.ts + shipments.dal.ts). When the
 * viewer is the driver the service strips `priceCents` and `offer`
 * (docs/specs/roles_spec.md §3), which is why both are optional here.
 */

export type ShipmentStatus =
  | "PENDING"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

/** A user attached to the shipment (shipper, carrier or driver). */
export interface ShipmentParty {
  id: string;
  name: string;
  image: string | null;
}

/** The job the shipment executes. */
export interface ShipmentListing {
  id: string;
  title: string;
  status: string;
}

/** The accepted offer's terms. Absent when the viewer is the driver. */
export interface ShipmentOffer {
  id: string;
  priceCents: number;
  estimatedPickup: string;
  estimatedDelivery: string;
}

/**
 * The client's half of the timeline. Present on every shipment payload, so a
 * surface never needs a second call to know whether the client signed off.
 * The two identity columns are stripped for a driver viewer.
 */
export interface ShipmentConfirmationSummary {
  id: string;
  milestone: "PICKED_UP" | "DELIVERED";
  /** `app` is this screen's own button; the other two arrive from elsewhere. */
  channel: "expedion_app" | "link" | "app";
  /** `operator` when staff answered on the client's behalf. */
  confirmedByRole: "client" | "operator";
  createdAt: string;
}

export interface ShipmentEvent {
  id: string;
  status: ShipmentStatus;
  previousStatus: ShipmentStatus | null;
  actorRole: string;
  note: string | null;
  createdAt: string;
}

export interface Shipment {
  id: string;
  listingId: string;
  offerId: string;
  shipperId: string;
  carrierId: string;
  driverId: string | null;
  status: ShipmentStatus;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  /** Stripped by the service when the viewer is the driver. */
  priceCents?: number;
  scheduledPickup: string | null;
  scheduledDelivery: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancelledBySide: CancellationSide | null;
  cancellationCategory: CancellationCategory | null;
  listing: ShipmentListing | null;
  offer?: ShipmentOffer | null;
  confirmations: ShipmentConfirmationSummary[];
  shipper: ShipmentParty;
  carrier: ShipmentParty;
  driver: ShipmentParty | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentWithEvents extends Shipment {
  events: ShipmentEvent[];
}

/** Envelope of GET /api/shipments, as built by shipmentService.getUserShipments. */
export interface ShipmentsPage {
  items: Shipment[];
  total: number;
  page: number;
  limit: number;
}

/** The two moments the client is asked to sign for. */
export type ConfirmableMilestone = "PICKED_UP" | "DELIVERED";

/**
 * What a confirmation write answers with — the service's projection, never the
 * row: the audit columns stay server-side.
 *
 * `alreadyConfirmed` is not an error. The unique index absorbs a second tap
 * and hands back the first answer, so a client who confirmed from the SMS and
 * then again here is told it is done rather than shown a failure.
 */
export interface ConfirmMilestoneResult {
  confirmation: ShipmentConfirmationSummary;
  alreadyConfirmed: boolean;
}

export interface ListShipmentsParams {
  /** Comma-separated status list, e.g. "PENDING,ASSIGNED". */
  status?: string;
  page?: number;
  limit?: number;
}

export const deliveriesApi = {
  list: (params: ListShipmentsParams = {}) =>
    api.get<ShipmentsPage>(`/api/shipments${toQuery(params)}`),

  getById: (id: string) => api.get<ShipmentWithEvents>(`/api/shipments/${id}`),

  cancel: (
    id: string,
    body: { category: CancellationCategory; reason?: string }
  ) => api.post<Shipment>(`/api/shipments/${id}/cancel`, body),

  /**
   * The client's attestation, from the app rather than from the link they were
   * texted. Records that a milestone happened and nothing else.
   */
  confirm: (id: string, body: { milestone: ConfirmableMilestone; note?: string }) =>
    api.post<ConfirmMilestoneResult>(`/api/shipments/${id}/confirm`, body),
};
