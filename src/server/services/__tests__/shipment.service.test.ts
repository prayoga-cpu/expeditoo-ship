import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/dal/shipments.dal", () => ({ shipmentsDal: {} }));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: {} }));
vi.mock("@/server/dal/listings.dal", () => ({ listingsDal: {} }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/server/services/expedion-bridge.service", () => ({
  expedionBridgeService: { onShipmentStatus: vi.fn().mockResolvedValue({}) },
  notifyExpedion: vi.fn(),
}));
// The status gate calls this, and an unmocked one reaches a real database.
vi.mock("@/server/services/shipment-photos.service", () => ({
  shipmentPhotosService: {
    hasStagePhoto: vi.fn().mockResolvedValue(true),
    stageCounts: vi.fn().mockResolvedValue({ pickup: 0, delivery: 0 }),
  },
}));
vi.mock("@/server/services/shipment-confirmations.service", () => ({
  shipmentConfirmationsService: {
    requestConfirmation: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/server/services/payments.service", () => ({
  paymentsService: {
    getForShipment: vi.fn().mockResolvedValue({ id: "pay-1", status: "captured" }),
    schedulePayout: vi.fn().mockResolvedValue({}),
    refundForShipment: vi.fn().mockResolvedValue({}),
  },
}));

import { shipmentService, ShipmentError } from "../shipment.service";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { shipmentConfirmationsService } from "@/server/services/shipment-confirmations.service";
import { paymentsService } from "@/server/services/payments.service";

/** A full user row as the DAL loads it - permission-blind by design. */
/**
 * Fixed, not `new Date()`.
 *
 * Assertions compare the service's output against a freshly built
 * `shipmentRow()`, so a per-call timestamp meant two different `new Date()`
 * values being compared for equality. They matched only when both landed in
 * the same millisecond, which made this file fail intermittently on full-suite
 * runs and pass every time in isolation.
 */
const FIXED_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

const userRow = (id: string, name: string) => ({
  id,
  name,
  email: `${id}@example.com`,
  emailVerified: true,
  image: null,
  banned: false,
  stripeCustomerId: `cus_${id}`,
  stripeAccountId: `acct_${id}`,
  stripeAccountStatus: "active",
  preferences: { notifyByEmail: true, phone: "+33600000000" },
  createdAt: FIXED_CREATED_AT,
});

/** The shipment graph `shipments.dal.getById` returns, relations and all. */
const shipmentRow = (over: Record<string, unknown> = {}) => ({
  id: "ship-1",
  listingId: "job-1",
  offerId: "offer-1",
  shipperId: "shipper-1",
  carrierId: "carrier-1",
  driverId: "driver-1",
  status: "ASSIGNED",
  pickupAddress: "12 rue de Lyon, Paris",
  dropoffAddress: "3 quai du Port, Marseille",
  priceCents: 42000,
  offer: { id: "offer-1", priceCents: 42000 },
  listing: {
    id: "job-1",
    title: "Pallet to Marseille",
    description: "One pallet, strapped",
    status: "in_progress",
    weightKg: 320,
    lengthCm: 120,
    widthCm: 80,
    heightCm: 100,
    quantity: 1,
    isFragile: false,
    needsHelp: true,
    budgetCents: 50000,
    shipperId: "shipper-1",
  },
  shipper: userRow("shipper-1", "Sofia Shipper"),
  carrier: userRow("carrier-1", "Carrier SAS"),
  driver: userRow("driver-1", "Dan Driver"),
  events: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(shipmentsDal, {
    getById: vi.fn().mockResolvedValue(shipmentRow()),
    getForUser: vi
      .fn()
      .mockResolvedValue({ items: [shipmentRow()], total: 1 }),
  });
});

async function codeFrom(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof ShipmentError) return error.code;
    throw error;
  }
  throw new Error("expected the call to throw");
}

/** Everything a driver must never receive, wherever it sits in the payload. */
const LEAKED_KEYS = [
  "email",
  "stripeCustomerId",
  "stripeAccountId",
  "stripeAccountStatus",
  "banned",
  "preferences",
  "budgetCents",
  "priceCents",
  "amountCents",
  "commissionCents",
];

function leakedKeysIn(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => leakedKeysIn(item, `${path}[${i}]`));
  }
  if (!value || typeof value !== "object") return [];

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [
      ...(LEAKED_KEYS.includes(key) ? [`${path}.${key}`] : []),
      ...leakedKeysIn(child, `${path}.${key}`),
    ]
  );
}

// ========================================
// Driver redaction — docs/specs/roles_spec.md §3
// ========================================

describe("shipmentService.getShipmentDetail (driver viewer)", () => {
  const driver = { userId: "driver-1" };

  it("returns nothing commercial or personal, at any depth", async () => {
    const detail = await shipmentService.getShipmentDetail("ship-1", driver);

    expect(leakedKeysIn(detail)).toEqual([]);
  });

  it("still carries what the driver screen renders", async () => {
    const detail = (await shipmentService.getShipmentDetail(
      "ship-1",
      driver
    )) as unknown as Record<string, Record<string, unknown>>;

    expect(detail.pickupAddress).toBe("12 rue de Lyon, Paris");
    expect(detail.listing.title).toBe("Pallet to Marseille");
    expect(detail.listing.weightKg).toBe(320);
    expect(detail.listing.needsHelp).toBe(true);
    expect(detail.shipper).toEqual({
      id: "shipper-1",
      name: "Sofia Shipper",
      image: null,
    });
  });

  it("redacts the list view the same way", async () => {
    const page = await shipmentService.getUserShipments(driver, {
      page: 1,
      limit: 20,
    });

    expect(leakedKeysIn(page.items)).toEqual([]);
  });

  it("keeps a null driver relation null rather than inventing a party", async () => {
    vi.mocked(shipmentsDal.getById).mockResolvedValue(
      shipmentRow({ driver: null }) as never
    );

    const detail = (await shipmentService.getShipmentDetail("ship-1", {
      userId: "driver-1",
    })) as unknown as Record<string, unknown>;

    expect(detail.driver).toBeNull();
  });
});

// ========================================
// The commercial parties are unaffected
// ========================================

describe("shipmentService.getShipmentDetail (shipper and carrier)", () => {
  it("gives the shipper the agreed price and the accepted offer", async () => {
    const detail = (await shipmentService.getShipmentDetail("ship-1", {
      userId: "shipper-1",
    })) as unknown as Record<string, unknown>;

    expect(detail.priceCents).toBe(42000);
    expect(detail.offer).toEqual({ id: "offer-1", priceCents: 42000 });
    expect(detail.shipper).toEqual(shipmentRow().shipper);
  });

  it("gives the carrier the agreed price too", async () => {
    const detail = (await shipmentService.getShipmentDetail("ship-1", {
      userId: "carrier-1",
    })) as unknown as Record<string, unknown>;

    expect(detail.priceCents).toBe(42000);
  });

  it("refuses a stranger", async () => {
    expect(
      await codeFrom(() =>
        shipmentService.getShipmentDetail("ship-1", { userId: "nobody" })
      )
    ).toBe("FORBIDDEN");
  });
});

/**
 * Asking the client to confirm what the transporter just recorded.
 * Covers docs/specs/transport_status_confirmation_spec.md §8.
 */
describe("shipmentService.updateStatus — the confirmation request", () => {
  const requestConfirmation = vi.mocked(
    shipmentConfirmationsService.requestConfirmation
  );

  const ownership = (status: string) => ({
    id: "ship-1",
    shipperId: "shipper-1",
    carrierId: "carrier-1",
    driverId: "driver-1",
    status,
    listingId: "job-1",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(shipmentsDal, {
      getOwnership: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue({ id: "ship-1" }),
      createEvent: vi.fn().mockResolvedValue({}),
    });
    Object.assign(listingsDal, { update: vi.fn().mockResolvedValue({}) });
  });

  const move = (from: string, to: string) => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership(from) as never
    );
    return shipmentService.updateStatus("ship-1", to as never, {
      userId: "carrier-1",
    });
  };

  it("asks the client to confirm the pickup when the run reaches it", async () => {
    await move("ASSIGNED", "PICKED_UP");

    expect(requestConfirmation).toHaveBeenCalledWith("ship-1", "PICKED_UP");
  });

  it("does not ask a second time when the run moves on to in-transit", async () => {
    // The regression: `IN_TRANSIT` also maps onto the pickup milestone for the
    // SMS, where the bridge dedupes. The email has no such guard, so mapping
    // it here mailed the same client the same question twice for one pickup.
    await move("PICKED_UP", "IN_TRANSIT");

    expect(requestConfirmation).not.toHaveBeenCalled();
  });

  it("asks the client to confirm reception on delivery", async () => {
    await move("IN_TRANSIT", "DELIVERED");

    expect(requestConfirmation).toHaveBeenCalledWith("ship-1", "DELIVERED");
  });

  it("asks for nothing on a stage the client never witnesses", async () => {
    await move("PENDING", "ASSIGNED");

    expect(requestConfirmation).not.toHaveBeenCalled();
  });
});

// ========================================
// Cancelling is not a status move
// ========================================
//
// `cancelShipment` moved to `shipment-cancellation.service.ts`, and this
// endpoint stopped being a second way to reach it. It used to accept
// `CANCELLED` and write `cancelled_at` with no reason, no side, no refund and
// a listing left live — from `PICKED_UP`, where the cancel endpoint itself
// refuses (docs/specs/cancellations_spec.md §7).

describe("shipmentService.updateStatus — the closed back door", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(shipmentsDal, {
      getOwnership: vi.fn().mockResolvedValue({
        id: "ship-1",
        listingId: "job-1",
        shipperId: "shipper-1",
        carrierId: "carrier-1",
        driverId: "driver-1",
        status: "ASSIGNED",
      }),
      updateStatus: vi.fn(),
      createEvent: vi.fn().mockResolvedValue({}),
    });
  });

  it("refuses to cancel a run", async () => {
    expect(
      await codeFrom(() =>
        shipmentService.updateStatus("ship-1", "CANCELLED", {
          userId: "carrier-1",
        })
      )
    ).toBe("CANCEL_VIA_CANCEL_ENDPOINT");
  });

  it("writes nothing on the way to refusing", async () => {
    await codeFrom(() =>
      shipmentService.updateStatus("ship-1", "CANCELLED", {
        userId: "carrier-1",
      })
    );

    expect(shipmentsDal.updateStatus).not.toHaveBeenCalled();
    expect(shipmentsDal.createEvent).not.toHaveBeenCalled();
  });
});
