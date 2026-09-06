import { carrierRoutesDal, type CarrierRouteRow } from "@/server/dal/carrier-routes.dal";
import { carrierService } from "@/server/services/carrier.service";
import {
  createCarrierRouteSchema,
  MAX_ROUTES_PER_CARRIER,
  type CreateCarrierRouteInput,
  type UpdateCarrierRouteInput,
} from "@/server/dto/carrier-routes.dto";

// ========================================
// Errors
// ========================================

export class CarrierRouteError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "CarrierRouteError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new CarrierRouteError(code, status, message);

// The matching rules are pure and shared with the trip card that renders the
// link, so they live in lib rather than being restated on each side.
export {
  nextOccurrence,
  routeMatchQuery,
  routeMatchHref,
} from "@/lib/carrier-route-matching";

// ========================================
// Mapping
// ========================================

function toColumns(input: CreateCarrierRouteInput, carrierId: string) {
  return {
    carrierId,
    label: input.label ?? null,
    kind: input.kind,
    originAddress: input.origin.address,
    originCity: input.origin.city,
    originPostalCode: input.origin.postalCode,
    originLat: input.origin.lat,
    originLng: input.origin.lng,
    destinationAddress: input.destination.address,
    destinationCity: input.destination.city,
    destinationPostalCode: input.destination.postalCode,
    destinationLat: input.destination.lat,
    destinationLng: input.destination.lng,
    radiusKm: input.radiusKm,
    daysOfWeek: input.daysOfWeek ?? [],
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    vehicleId: input.vehicleId ?? null,
    capacityKg: input.capacityKg ?? null,
    notifyOnMatch: input.notifyOnMatch,
    isActive: input.isActive,
    isDiscoverable: input.isDiscoverable,
  };
}

/** The stored row read back in the shape the create schema validates. */
function toInput(route: CarrierRouteRow): CreateCarrierRouteInput {
  return {
    label: route.label ?? undefined,
    kind: route.kind,
    origin: {
      address: route.originAddress,
      city: route.originCity,
      postalCode: route.originPostalCode,
      lat: route.originLat,
      lng: route.originLng,
    },
    destination: {
      address: route.destinationAddress,
      city: route.destinationCity,
      postalCode: route.destinationPostalCode,
      lat: route.destinationLat,
      lng: route.destinationLng,
    },
    radiusKm: route.radiusKm,
    daysOfWeek: route.daysOfWeek,
    dates: route.dates.map((d) => d.date),
    validFrom: route.validFrom ?? undefined,
    validUntil: route.validUntil ?? undefined,
    vehicleId: route.vehicleId ?? undefined,
    capacityKg: route.capacityKg ?? undefined,
    notifyOnMatch: route.notifyOnMatch,
    isActive: route.isActive,
    isDiscoverable: route.isDiscoverable,
  };
}

/** `null` in a patch means "clear it"; `undefined` means "leave it". */
function coalesce<T>(patched: T | null | undefined, stored: T | undefined) {
  if (patched === null) return undefined;
  return patched === undefined ? stored : patched;
}

// ========================================
// Service
// ========================================

export const carrierRoutesService = {
  async list(userId: string) {
    const carrier = await carrierService.requireOwnCarrier(userId);
    const items = await carrierRoutesDal.listByCarrier(carrier.id);

    return { items, total: items.length };
  },

  async get(userId: string, routeId: string) {
    const carrier = await carrierService.requireOwnCarrier(userId);
    const route = await carrierRoutesDal.getOwned(routeId, carrier.id);
    if (!route) throw err("ROUTE_NOT_FOUND", 404);

    return route;
  },

  async create(userId: string, input: CreateCarrierRouteInput) {
    const carrier = await carrierService.requireOwnCarrier(userId);
    if (carrier.status === "suspended") throw err("CARRIER_SUSPENDED", 409);

    const count = await carrierRoutesDal.countByCarrier(carrier.id);
    if (count >= MAX_ROUTES_PER_CARRIER) {
      throw err("ROUTE_LIMIT_REACHED", 409);
    }

    assertOwnVehicle(carrier.vehicles, input.vehicleId);

    const created = await carrierRoutesDal.create(
      toColumns(input, carrier.id),
      input.dates ?? []
    );
    if (!created) throw err("ROUTE_CREATE_FAILED", 500);

    return created;
  },

  /**
   * The patch is merged onto the stored row and the *result* is re-validated,
   * so a trip cannot be edited into an illegal shape one field at a time —
   * flipping `kind` without supplying the matching "when" is rejected here even
   * though each field on its own is fine.
   */
  async update(userId: string, routeId: string, patch: UpdateCarrierRouteInput) {
    const carrier = await carrierService.requireOwnCarrier(userId);
    if (carrier.status === "suspended") throw err("CARRIER_SUSPENDED", 409);

    const stored = await carrierRoutesDal.getOwned(routeId, carrier.id);
    if (!stored) throw err("ROUTE_NOT_FOUND", 404);

    const current = toInput(stored);
    const kind = patch.kind ?? current.kind;

    const merged = createCarrierRouteSchema.parse({
      ...current,
      ...patch,
      kind,
      // A kind flip drops the other kind's "when" unless the patch replaces it.
      daysOfWeek:
        kind === "recurring"
          ? (patch.daysOfWeek ?? (patch.kind ? undefined : current.daysOfWeek))
          : undefined,
      dates:
        kind === "occasional"
          ? (patch.dates ?? (patch.kind ? undefined : current.dates))
          : undefined,
      label: coalesce(patch.label, current.label),
      vehicleId: coalesce(patch.vehicleId, current.vehicleId),
      capacityKg: coalesce(patch.capacityKg, current.capacityKg),
      validFrom: coalesce(patch.validFrom, current.validFrom),
      validUntil: coalesce(patch.validUntil, current.validUntil),
      origin: patch.origin ?? current.origin,
      destination: patch.destination ?? current.destination,
    });

    assertOwnVehicle(carrier.vehicles, merged.vehicleId);

    const updated = await carrierRoutesDal.update(
      routeId,
      toColumns(merged, carrier.id),
      merged.dates ?? []
    );
    if (!updated) throw err("ROUTE_NOT_FOUND", 404);

    return updated;
  },

  async remove(userId: string, routeId: string) {
    const carrier = await carrierService.requireOwnCarrier(userId);

    const stored = await carrierRoutesDal.getOwned(routeId, carrier.id);
    if (!stored) throw err("ROUTE_NOT_FOUND", 404);

    return await carrierRoutesDal.remove(routeId);
  },
};

/** A trip may only name a vehicle from the carrier's own fleet. */
function assertOwnVehicle(
  fleet: { id: string }[],
  vehicleId: string | null | undefined
) {
  if (!vehicleId) return;
  if (!fleet.some((vehicle) => vehicle.id === vehicleId)) {
    throw err("VEHICLE_NOT_FOUND", 404);
  }
}
