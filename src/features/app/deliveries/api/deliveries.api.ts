import { api, toQuery } from "@/lib/fetcher";

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
  proofOfDeliveryUrl: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  listing: ShipmentListing | null;
  offer?: ShipmentOffer | null;
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

  cancel: (id: string, reason: string) =>
    api.post<Shipment>(`/api/shipments/${id}/cancel`, { reason }),
};
