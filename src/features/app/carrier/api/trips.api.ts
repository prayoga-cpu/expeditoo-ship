import { api, toQuery } from "@/lib/fetcher";

/**
 * Client API for the carrier's trips and the money their completed runs
 * produced (docs/specs/carrier_trips_spec.md,
 * docs/specs/billing_documents_spec.md).
 */

export type CarrierRouteKind = "recurring" | "occasional";

export interface CarrierRouteEndpointInput {
  address: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
}

export interface CarrierRouteDate {
  id: string;
  date: string;
}

export interface CarrierRouteVehicle {
  id: string;
  type: string;
  plateNumber: string;
  maxWeightKg: number;
}

export interface CarrierRoute {
  id: string;
  label: string | null;
  kind: CarrierRouteKind;
  originAddress: string;
  originCity: string;
  originPostalCode: string;
  originLat: number;
  originLng: number;
  destinationAddress: string;
  destinationCity: string;
  destinationPostalCode: string;
  destinationLat: number;
  destinationLng: number;
  radiusKm: number;
  daysOfWeek: number[];
  validFrom: string | null;
  validUntil: string | null;
  vehicleId: string | null;
  vehicle: CarrierRouteVehicle | null;
  capacityKg: number | null;
  notifyOnMatch: boolean;
  isActive: boolean;
  dates: CarrierRouteDate[];
  createdAt: string;
}

export interface CarrierRouteInput {
  label?: string;
  kind: CarrierRouteKind;
  origin: CarrierRouteEndpointInput;
  destination: CarrierRouteEndpointInput;
  radiusKm: number;
  daysOfWeek?: number[];
  /** ISO strings; the server coerces them to dates. */
  dates?: string[];
  vehicleId?: string | null;
  capacityKg?: number | null;
  notifyOnMatch: boolean;
  isActive: boolean;
}

export interface EarningsItem {
  shipmentId: string;
  listingId: string;
  listingTitle: string | null;
  reference: string;
  deliveredAt: string | null;
  pickupCity: string;
  dropoffCity: string;
  priceCents: number;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  capturedAt: string | null;
  paymentStatus: string | null;
  payoutStatus: string | null;
  paidAt: string | null;
}

export interface EarningsSummary {
  deliveries: number;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  paidCents: number;
  pendingCents: number;
}

export interface EarningsResponse {
  items: EarningsItem[];
  summary: EarningsSummary;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** True while the platform retains the whole amount — see the spec §2. */
  commissionRetainsAll: boolean;
}

export interface EarningsFilters {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const tripsApi = {
  listRoutes: () =>
    api.get<{ items: CarrierRoute[]; total: number }>("/api/carrier/routes"),

  createRoute: (input: CarrierRouteInput) =>
    api.post<CarrierRoute>("/api/carrier/routes", input),

  updateRoute: (id: string, input: Partial<CarrierRouteInput>) =>
    api.patch<CarrierRoute>(`/api/carrier/routes/${id}`, input),

  deleteRoute: (id: string) =>
    api.delete<{ id: string }>(`/api/carrier/routes/${id}`),

  earnings: (filters: EarningsFilters = {}) =>
    api.get<EarningsResponse>(`/api/carrier/earnings${toQuery(filters)}`),
};

/** The statement is a file download, so it is a URL rather than a fetch. */
export function earningsStatementUrl(period: { from?: string; to?: string }) {
  return `/api/carrier/earnings/statement${toQuery(period)}`;
}
