import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Map pins for a request posted without them — the accept that was blocked
 * by COORDINATES_REQUIRED (client_feedback_2026_10_29_spec.md §P1).
 */

const m = vi.hoisted(() => ({ searchAddress: vi.fn(), setMissingPins: vi.fn() }));
vi.mock("@/lib/geocoding", () => ({ searchAddress: m.searchAddress }));
vi.mock("@/server/dal/listings.dal", () => ({
  listingsDal: { setMissingPins: m.setMissingPins },
}));

import { listingPinsService, locate } from "../listing-pins.service";

const listing = (over: Record<string, unknown> = {}) => ({
  id: "job-1",
  pickupLat: null as number | null,
  pickupLng: null as number | null,
  dropoffLat: 45.76 as number | null,
  dropoffLng: 4.84 as number | null,
  pickupAddress: "12 rue Imaginaire",
  pickupPostalCode: "75011",
  pickupCity: "Paris",
  dropoffAddress: "1 place Bellecour",
  dropoffPostalCode: "69002",
  dropoffCity: "Lyon",
  ...over,
});
const hit = (lat: number, lng: number) => [{ id: "1", place_name: "x", center: [lng, lat] }];

beforeEach(() => {
  vi.clearAllMocks();
  m.setMissingPins.mockImplementation(async (_id: string, pins: object) => pins);
});

describe("locate", () => {
  it("tries the full address, then postcode and town, then the town", async () => {
    m.searchAddress.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce(hit(48.85, 2.35));
    const point = await locate("12 rue Imaginaire", "75011", "Paris");
    expect(m.searchAddress.mock.calls.map((c) => c[0])).toEqual([
      "12 rue Imaginaire, 75011, Paris",
      "75011, Paris",
      "Paris",
    ]);
    expect(point).toEqual({ lat: 48.85, lng: 2.35 });
  });

  it("searches France and its neighbours, for job postcodes from abroad", async () => {
    m.searchAddress.mockResolvedValue(hit(50.85, 4.35));
    await locate("Rue Neuve 1", "1000", "Bruxelles");
    expect(m.searchAddress.mock.calls[0][1]).toContain("be");
  });

  it("stops at the first lookup that finds something", async () => {
    m.searchAddress.mockResolvedValue(hit(48.85, 2.35));
    await locate("12 rue Imaginaire", "75011", "Paris");
    expect(m.searchAddress).toHaveBeenCalledTimes(1);
  });

  it("answers nothing when not even the town is known", async () => {
    m.searchAddress.mockResolvedValue([]);
    expect(await locate("x", null, "Nulle-Part")).toBeNull();
  });
});

describe("listingPinsService.ensurePins", () => {
  it("leaves a request that has both pins alone, and asks nobody", async () => {
    const pinned = listing({ pickupLat: 48.85, pickupLng: 2.35 });
    expect(await listingPinsService.ensurePins(pinned)).toBe(pinned);
    expect(m.searchAddress).not.toHaveBeenCalled();
    expect(m.setMissingPins).not.toHaveBeenCalled();
  });

  it("looks up only the missing end and keeps the result on the request", async () => {
    m.searchAddress.mockResolvedValue(hit(48.85, 2.35));
    const result = await listingPinsService.ensurePins(listing());

    expect(m.searchAddress).toHaveBeenCalledTimes(1);
    expect(m.setMissingPins).toHaveBeenCalledWith("job-1", {
      pickupLat: 48.85,
      pickupLng: 2.35,
      dropoffLat: 45.76,
      dropoffLng: 4.84,
    });
    expect(result).toMatchObject({ pickupLat: 48.85, pickupLng: 2.35 });
  });

  it("leaves the request as it was when an end cannot be placed", async () => {
    m.searchAddress.mockResolvedValue([]);
    const original = listing();
    expect(await listingPinsService.ensurePins(original)).toBe(original);
    expect(m.setMissingPins).not.toHaveBeenCalled();
  });
});
