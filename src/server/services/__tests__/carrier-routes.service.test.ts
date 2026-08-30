import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  carrierRoutesService,
  CarrierRouteError,
} from "../carrier-routes.service";
import { carrierRoutesDal } from "@/server/dal/carrier-routes.dal";
import { carrierService } from "@/server/services/carrier.service";
import {
  createCarrierRouteSchema,
  MAX_ROUTES_PER_CARRIER,
} from "@/server/dto/carrier-routes.dto";
import {
  MAX_DEEP_LINK_DAYS,
  nextOccurrence,
  routeMatchQuery,
} from "@/lib/carrier-route-matching";

// Covers docs/specs/carrier_trips_spec.md §11.

vi.mock("@/server/dal/carrier-routes.dal", () => ({
  carrierRoutesDal: {
    listByCarrier: vi.fn(),
    countByCarrier: vi.fn(),
    getOwned: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/server/services/carrier.service", () => ({
  carrierService: { requireOwnCarrier: vi.fn() },
  CarrierError: class extends Error {},
}));

const APPROVED = {
  id: "carrier-1",
  status: "approved",
  vehicles: [{ id: "veh-1" }],
};

const PARIS = {
  address: "1 rue de Rivoli",
  city: "Paris",
  postalCode: "75001",
  lat: 48.86,
  lng: 2.34,
};

const LYON = {
  address: "10 rue de la Ré",
  city: "Lyon",
  postalCode: "69002",
  lat: 45.76,
  lng: 4.83,
};

const recurringInput = (overrides: Record<string, unknown> = {}) =>
  createCarrierRouteSchema.parse({
    kind: "recurring",
    origin: PARIS,
    destination: LYON,
    daysOfWeek: [2, 4],
    ...overrides,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(carrierService.requireOwnCarrier).mockResolvedValue(
    APPROVED as never
  );
  vi.mocked(carrierRoutesDal.countByCarrier).mockResolvedValue(0);
});

// ========================================
// Validation — §4
// ========================================

describe("createCarrierRouteSchema", () => {
  it("rejects a recurring trip with no weekday", () => {
    expect(() =>
      createCarrierRouteSchema.parse({
        kind: "recurring",
        origin: PARIS,
        destination: LYON,
      })
    ).toThrow(/RECURRING_REQUIRES_DAYS/);
  });

  it("rejects a recurring trip that also carries dates", () => {
    expect(() =>
      createCarrierRouteSchema.parse({
        kind: "recurring",
        origin: PARIS,
        destination: LYON,
        daysOfWeek: [1],
        dates: ["2026-09-12"],
      })
    ).toThrow(/RECURRING_REJECTS_DATES/);
  });

  it("rejects an occasional trip with no date", () => {
    expect(() =>
      createCarrierRouteSchema.parse({
        kind: "occasional",
        origin: PARIS,
        destination: LYON,
      })
    ).toThrow(/OCCASIONAL_REQUIRES_DATES/);
  });

  it("rejects an occasional trip that also carries weekdays", () => {
    expect(() =>
      createCarrierRouteSchema.parse({
        kind: "occasional",
        origin: PARIS,
        destination: LYON,
        dates: ["2026-09-12"],
        daysOfWeek: [3],
      })
    ).toThrow(/OCCASIONAL_REJECTS_DAYS/);
  });

  it("rejects duplicate weekdays and duplicate dates", () => {
    expect(() =>
      createCarrierRouteSchema.parse({
        kind: "recurring",
        origin: PARIS,
        destination: LYON,
        daysOfWeek: [2, 2],
      })
    ).toThrow(/DUPLICATE_DAYS/);

    expect(() =>
      createCarrierRouteSchema.parse({
        kind: "occasional",
        origin: PARIS,
        destination: LYON,
        dates: ["2026-09-12", "2026-09-12"],
      })
    ).toThrow(/DUPLICATE_DATES/);
  });

  it("rejects a validity window that ends before it starts", () => {
    expect(() =>
      createCarrierRouteSchema.parse({
        kind: "recurring",
        origin: PARIS,
        destination: LYON,
        daysOfWeek: [1],
        validFrom: "2026-09-10",
        validUntil: "2026-09-01",
      })
    ).toThrow(/INVALID_VALIDITY_WINDOW/);
  });

  it("accepts a past date, because an elapsed trip is history", () => {
    expect(() =>
      createCarrierRouteSchema.parse({
        kind: "occasional",
        origin: PARIS,
        destination: LYON,
        dates: ["2020-01-01"],
      })
    ).not.toThrow();
  });
});

// ========================================
// Permissions — §5
// ========================================

describe("carrierRoutesService permissions", () => {
  it("propagates CARRIER_NOT_FOUND when the caller has no carrier record", async () => {
    vi.mocked(carrierService.requireOwnCarrier).mockRejectedValue(
      new Error("CARRIER_NOT_FOUND")
    );

    await expect(carrierRoutesService.list("u1")).rejects.toThrow(
      "CARRIER_NOT_FOUND"
    );
  });

  it("refuses to create for a suspended carrier", async () => {
    vi.mocked(carrierService.requireOwnCarrier).mockResolvedValue({
      ...APPROVED,
      status: "suspended",
    } as never);

    await expect(
      carrierRoutesService.create("u1", recurringInput())
    ).rejects.toMatchObject({ code: "CARRIER_SUSPENDED", status: 409 });
  });

  it("answers ROUTE_NOT_FOUND rather than 403 for someone else's trip", async () => {
    vi.mocked(carrierRoutesDal.getOwned).mockResolvedValue(undefined as never);

    await expect(carrierRoutesService.get("u1", "r-other")).rejects.toMatchObject(
      { code: "ROUTE_NOT_FOUND", status: 404 }
    );
  });

  it("stops the 21st trip", async () => {
    vi.mocked(carrierRoutesDal.countByCarrier).mockResolvedValue(
      MAX_ROUTES_PER_CARRIER
    );

    await expect(
      carrierRoutesService.create("u1", recurringInput())
    ).rejects.toMatchObject({ code: "ROUTE_LIMIT_REACHED", status: 409 });
  });

  it("refuses a vehicle that is not in the caller's fleet", async () => {
    await expect(
      carrierRoutesService.create("u1", recurringInput({ vehicleId: "veh-x" }))
    ).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND", status: 404 });
  });

  it("accepts a vehicle the caller owns", async () => {
    vi.mocked(carrierRoutesDal.create).mockResolvedValue({ id: "r1" } as never);

    await expect(
      carrierRoutesService.create("u1", recurringInput({ vehicleId: "veh-1" }))
    ).resolves.toMatchObject({ id: "r1" });
  });
});

// ========================================
// Patch merging — §6
// ========================================

describe("carrierRoutesService.update", () => {
  const stored = {
    id: "r1",
    label: "Retour",
    kind: "occasional" as const,
    originAddress: PARIS.address,
    originCity: PARIS.city,
    originPostalCode: PARIS.postalCode,
    originLat: PARIS.lat,
    originLng: PARIS.lng,
    destinationAddress: LYON.address,
    destinationCity: LYON.city,
    destinationPostalCode: LYON.postalCode,
    destinationLat: LYON.lat,
    destinationLng: LYON.lng,
    radiusKm: 40,
    daysOfWeek: [] as number[],
    validFrom: null,
    validUntil: null,
    vehicleId: null,
    capacityKg: null,
    notifyOnMatch: true,
    isActive: true,
    dates: [{ date: new Date("2026-09-12T00:00:00Z") }],
  };

  beforeEach(() => {
    vi.mocked(carrierRoutesDal.getOwned).mockResolvedValue(stored as never);
    vi.mocked(carrierRoutesDal.update).mockResolvedValue({ id: "r1" } as never);
  });

  it("preserves the stored dates when the patch omits them", async () => {
    await carrierRoutesService.update("u1", "r1", { radiusKm: 90 });

    const [, columns, dates] = vi.mocked(carrierRoutesDal.update).mock.calls[0];
    expect(columns.radiusKm).toBe(90);
    expect(dates).toHaveLength(1);
  });

  it("replaces the whole set when the patch sends dates", async () => {
    await carrierRoutesService.update("u1", "r1", {
      dates: [new Date("2026-10-01"), new Date("2026-10-08")],
    });

    const [, , dates] = vi.mocked(carrierRoutesDal.update).mock.calls[0];
    expect(dates).toHaveLength(2);
  });

  it("rejects a kind flip that leaves the trip with no schedule", async () => {
    await expect(
      carrierRoutesService.update("u1", "r1", { kind: "recurring" })
    ).rejects.toThrow(/RECURRING_REQUIRES_DAYS/);
  });

  it("accepts a kind flip that brings its own schedule", async () => {
    await carrierRoutesService.update("u1", "r1", {
      kind: "recurring",
      daysOfWeek: [1, 5],
    });

    const [, columns, dates] = vi.mocked(carrierRoutesDal.update).mock.calls[0];
    expect(columns.kind).toBe("recurring");
    expect(columns.daysOfWeek).toEqual([1, 5]);
    expect(dates).toEqual([]);
  });
});

// ========================================
// Matching — §7
// ========================================

describe("nextOccurrence", () => {
  // 2026-09-09 is a Wednesday (ISO weekday 3).
  const now = new Date(2026, 8, 9, 12, 0, 0);

  it("picks the earliest future date of an occasional trip", () => {
    const result = nextOccurrence(
      {
        kind: "occasional",
        daysOfWeek: [],
        validFrom: null,
        validUntil: null,
        dates: [
          { date: new Date(2026, 8, 20) },
          { date: new Date(2026, 8, 14) },
          { date: new Date(2026, 7, 1) },
        ],
      },
      now
    );

    expect(result?.getDate()).toBe(14);
  });

  it("returns null when every date has elapsed", () => {
    const result = nextOccurrence(
      {
        kind: "occasional",
        daysOfWeek: [],
        validFrom: null,
        validUntil: null,
        dates: [{ date: new Date(2020, 0, 1) }],
      },
      now
    );

    expect(result).toBeNull();
  });

  it("picks today when today is one of the weekdays", () => {
    const result = nextOccurrence(
      {
        kind: "recurring",
        daysOfWeek: [3],
        validFrom: null,
        validUntil: null,
        dates: [],
      },
      now
    );

    expect(result?.getDate()).toBe(9);
  });

  it("walks forward to the next matching weekday", () => {
    const result = nextOccurrence(
      {
        kind: "recurring",
        daysOfWeek: [6],
        validFrom: null,
        validUntil: null,
        dates: [],
      },
      now
    );

    expect(result?.getDate()).toBe(12);
  });

  it("returns null once the validity window has passed", () => {
    const result = nextOccurrence(
      {
        kind: "recurring",
        daysOfWeek: [3],
        validFrom: null,
        validUntil: new Date(2026, 7, 1),
        dates: [],
      },
      now
    );

    expect(result).toBeNull();
  });
});

describe("routeMatchQuery", () => {
  const base = {
    kind: "recurring" as const,
    daysOfWeek: [3],
    dates: [],
    validFrom: null,
    validUntil: null,
    originCity: "Paris",
    originLat: 48.86,
    originLng: 2.34,
    destinationCity: "Bordeaux",
    destinationLat: 44.84,
    destinationLng: -0.58,
    radiusKm: 75,
    capacityKg: null,
  };

  const now = new Date(2026, 8, 9, 12, 0, 0);

  it("maps both endpoints, radius and sort onto the board's parameters", () => {
    const query = routeMatchQuery(base, now);

    expect(query.fromLat).toBe("48.86");
    expect(query.fromLng).toBe("2.34");
    expect(query.radiusKm).toBe("75");
    expect(query.sort).toBe("distance_asc");
  });

  it("filters on the destination, so a trip searches its corridor", () => {
    // The limitation carrier_trips_spec.md §10.1 recorded: the board had no
    // two-endpoint predicate, so the destination could not be a filter.
    const query = routeMatchQuery(base, now);

    expect(query.toLat).toBe("44.84");
    expect(query.toLng).toBe("-0.58");
  });

  it("carries the city names so the board can label the search", () => {
    const query = routeMatchQuery(base, now);

    expect(query.fromLabel).toBe("Paris");
    expect(query.toLabel).toBe("Bordeaux");
  });

  it("omits maxWeightKg when no capacity is declared", () => {
    expect(routeMatchQuery(base, now).maxWeightKg).toBeUndefined();
  });

  it("passes capacity through as maxWeightKg", () => {
    const query = routeMatchQuery({ ...base, capacityKg: 800 }, now);
    expect(query.maxWeightKg).toBe("800");
  });

  it("omits the days when every occurrence has elapsed", () => {
    const query = routeMatchQuery(
      { ...base, validUntil: new Date(2026, 7, 1) },
      now
    );

    expect(query.days).toBeUndefined();
    // Geography still narrows the board even with no upcoming run.
    expect(query.fromLat).toBe("48.86");
  });

  it("lists several upcoming runs, not just the next one", () => {
    // 9 September 2026 is a Wednesday, and the trip runs on Wednesdays.
    const days = routeMatchQuery(base, now).days.split(",");

    expect(days[0]).toBe("2026-09-09");
    expect(days[1]).toBe("2026-09-16");
    expect(days).toHaveLength(MAX_DEEP_LINK_DAYS);
  });

  it("stops listing runs at validUntil", () => {
    const query = routeMatchQuery(
      { ...base, validUntil: new Date(2026, 8, 20) },
      now
    );

    expect(query.days.split(",")).toEqual(["2026-09-09", "2026-09-16"]);
  });

  it("lists an occasional trip's own dates", () => {
    const query = routeMatchQuery(
      {
        ...base,
        kind: "occasional",
        daysOfWeek: [],
        dates: [
          { date: new Date(2026, 8, 12) },
          { date: new Date(2026, 7, 1) },
          { date: new Date(2026, 8, 30) },
        ],
      },
      now
    );

    // Elapsed dates drop out; the rest come back soonest first.
    expect(query.days).toBe("2026-09-12,2026-09-30");
  });
});

describe("CarrierRouteError", () => {
  it("carries a code and a status for the REST layer to translate", () => {
    const error = new CarrierRouteError("ROUTE_NOT_FOUND", 404);
    expect(error.code).toBe("ROUTE_NOT_FOUND");
    expect(error.status).toBe(404);
  });
});
