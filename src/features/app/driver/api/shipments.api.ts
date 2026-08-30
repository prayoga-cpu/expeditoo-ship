import { api, toQuery } from "@/lib/fetcher";

/**
 * Client API for the driver execution surface.
 *
 * The shipment service redacts commercial terms for drivers (no `priceCents`,
 * no `offer` — docs/specs/roles_spec.md §3), so these types deliberately
 * contain nothing price-shaped. Do not add money fields here.
 */

export type DriverShipmentStatus =
  | "PENDING"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

/** The cargo facts a driver needs from the underlying job. */
export interface DriverShipmentListing {
  id: string;
  title: string;
  description: string;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  quantity: number;
  isFragile: boolean;
  needsHelp: boolean;
}

/**
 * The client's attestation of a milestone. A driver sees *that* the client
 * confirmed, never who they are — the service drops both identity columns for
 * a driver viewer (transport_status_confirmation_spec.md §9.4).
 */
export interface DriverShipmentConfirmation {
  id: string;
  milestone: "PICKED_UP" | "DELIVERED";
  channel: "expedion_app" | "link";
  confirmedByRole: "client" | "operator";
  createdAt: string;
}

export interface DriverShipmentEvent {
  id: string;
  status: DriverShipmentStatus;
  previousStatus: DriverShipmentStatus | null;
  actorRole: string;
  note: string | null;
  createdAt: string;
}

export interface DriverShipment {
  id: string;
  status: DriverShipmentStatus;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  scheduledPickup: string | null;
  scheduledDelivery: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  listing: DriverShipmentListing | null;
  confirmations: DriverShipmentConfirmation[];
  createdAt: string;
  updatedAt: string;
}

export interface DriverShipmentDetail extends DriverShipment {
  events: DriverShipmentEvent[];
}

/** Envelope of GET /api/shipments, as built by shipmentService.getUserShipments. */
export interface DriverShipmentsPage {
  items: DriverShipment[];
  total: number;
  page: number;
  limit: number;
}

export const driverShipmentsApi = {
  list: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get<DriverShipmentsPage>(`/api/shipments${toQuery(params)}`),

  get: (id: string) => api.get<DriverShipmentDetail>(`/api/shipments/${id}`),

  /**
   * Claim a run that is still PENDING. The route takes the driver's user id
   * explicitly because a carrier may nominate anyone in its fleet; this surface
   * always passes the viewer's own id (see `useAssignSelfToShipment`).
   */
  assign: (id: string, driverId: string) =>
    api.post<DriverShipment>(`/api/shipments/${id}/assign`, { driverId }),

  updateStatus: (id: string, status: DriverShipmentStatus, note?: string) =>
    api.patch<DriverShipment>(`/api/shipments/${id}/status`, { status, note }),

  /** Step 1 of proof of delivery: put the photo in storage. */
  uploadPodPhoto: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return api.post<{ url: string }>("/api/upload", body);
  },

  /** Step 2: attach the photo, which also closes the run as DELIVERED. */
  submitProofOfDelivery: (id: string, url: string) =>
    api.post<DriverShipment>(`/api/shipments/${id}/proof-of-delivery`, { url }),
};
