import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The gate from shipment_photos_spec.md §3.6: the two moves that change hands
 * are refused until that stage has been photographed.
 *
 * The point of testing the *refusal* rather than only the success is the money.
 * `-> DELIVERED` captures a payment and schedules a payout, and a delivery
 * that settles and only then discovers it has no evidence is a delivery that
 * cannot be undone. So every refusal here also asserts that nothing was
 * written and nothing was captured.
 */

vi.mock("@/server/dal/shipments.dal", () => ({
  shipmentsDal: {
    getOwnership: vi.fn(),
    updateStatus: vi.fn(),
    createEvent: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: {} }));
vi.mock("@/server/dal/listings.dal", () => ({
  listingsDal: { update: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/server/services/expedion-bridge.service", () => ({
  expedionBridgeService: { onShipmentStatus: vi.fn().mockResolvedValue({}) },
  notifyExpedion: vi.fn(),
}));
vi.mock("@/server/services/payments.service", () => ({
  paymentsService: {
    getForShipment: vi.fn().mockResolvedValue({ id: "pay-1", status: "captured" }),
    schedulePayout: vi.fn().mockResolvedValue({}),
    refundForShipment: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("@/server/services/invoices.service", () => ({
  invoicesService: { createFromPayment: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/server/services/shipment-photos.service", () => ({
  shipmentPhotosService: {
    hasStagePhoto: vi.fn(),
    stageCounts: vi.fn().mockResolvedValue({ pickup: 0, delivery: 0 }),
  },
}));

import { shipmentService } from "../shipment.service";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { paymentsService } from "@/server/services/payments.service";
import { shipmentPhotosService } from "@/server/services/shipment-photos.service";

const BASE = {
  id: "ship-1",
  listingId: "job-1",
  shipperId: "shipper-1",
  carrierId: "carrier-1",
  driverId: "driver-1",
};

const DRIVER = { userId: "driver-1" };
const OPERATOR = { userId: "ops-1", isOperator: true };

function atStatus(status: string) {
  vi.mocked(shipmentsDal.getOwnership).mockResolvedValue({
    ...BASE,
    status,
  } as never);
  vi.mocked(shipmentsDal.updateStatus).mockResolvedValue({
    ...BASE,
    status,
  } as never);
}

const hasPhoto = (answer: boolean) =>
  vi.mocked(shipmentPhotosService.hasStagePhoto).mockResolvedValue(answer);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(paymentsService.getForShipment).mockResolvedValue({
    id: "pay-1",
    status: "captured",
  } as never);
});

describe("pickup needs a pickup photo", () => {
  it("refuses ASSIGNED -> PICKED_UP with none, and writes nothing", async () => {
    atStatus("ASSIGNED");
    hasPhoto(false);

    await expect(
      shipmentService.updateStatus("ship-1", "PICKED_UP", DRIVER)
    ).rejects.toMatchObject({ code: "PICKUP_PHOTO_REQUIRED", status: 409 });

    expect(shipmentsDal.updateStatus).not.toHaveBeenCalled();
    expect(shipmentsDal.createEvent).not.toHaveBeenCalled();
  });

  it("allows it once one exists, and asks about the pickup stage", async () => {
    atStatus("ASSIGNED");
    hasPhoto(true);

    await shipmentService.updateStatus("ship-1", "PICKED_UP", DRIVER);

    expect(shipmentPhotosService.hasStagePhoto).toHaveBeenCalledWith(
      "ship-1",
      "pickup"
    );
    expect(shipmentsDal.updateStatus).toHaveBeenCalledWith(
      "ship-1",
      "PICKED_UP"
    );
  });
});

describe("delivery needs a delivery photo", () => {
  it("refuses IN_TRANSIT -> DELIVERED with none, and captures nothing", async () => {
    atStatus("IN_TRANSIT");
    hasPhoto(false);

    await expect(
      shipmentService.updateStatus("ship-1", "DELIVERED", DRIVER)
    ).rejects.toMatchObject({ code: "DELIVERY_PHOTO_REQUIRED", status: 409 });

    // The one that would have been irreversible. The client paid at booking,
    // so what delivery settles is the driver's half.
    expect(paymentsService.schedulePayout).not.toHaveBeenCalled();
    expect(shipmentsDal.updateStatus).not.toHaveBeenCalled();
  });

  it("allows it once one exists", async () => {
    atStatus("IN_TRANSIT");
    hasPhoto(true);

    await shipmentService.updateStatus("ship-1", "DELIVERED", DRIVER);

    expect(shipmentPhotosService.hasStagePhoto).toHaveBeenCalledWith(
      "ship-1",
      "delivery"
    );
    expect(paymentsService.schedulePayout).toHaveBeenCalledWith(
      "ship-1",
      "carrier-1"
    );
  });
});

describe("who the gate applies to, and what it leaves alone", () => {
  // An operator moving a stuck run is exactly the case where the record most
  // needs to say what was seen. Support has `cancelShipment` for the rest.
  it("gates staff the same as a driver", async () => {
    atStatus("IN_TRANSIT");
    hasPhoto(false);

    await expect(
      shipmentService.updateStatus("ship-1", "DELIVERED", OPERATOR)
    ).rejects.toMatchObject({ code: "DELIVERY_PHOTO_REQUIRED" });
  });

  it("never blocks PICKED_UP -> IN_TRANSIT: nothing changes hands there", async () => {
    atStatus("PICKED_UP");
    hasPhoto(false);

    await shipmentService.updateStatus("ship-1", "IN_TRANSIT", DRIVER);

    expect(shipmentPhotosService.hasStagePhoto).not.toHaveBeenCalled();
    expect(shipmentsDal.updateStatus).toHaveBeenCalledWith(
      "ship-1",
      "IN_TRANSIT"
    );
  });

  // A job being called off is the last thing that should demand a photograph —
  // and it no longer comes through here at all. `updateStatus` refuses
  // `CANCELLED` outright, before the gate is even consulted, so the two ways
  // this invariant could break are both covered: the gate is not reached, and
  // the write does not happen (docs/specs/cancellations_spec.md §7).
  it("never asks for a photo to call a job off", async () => {
    atStatus("ASSIGNED");
    hasPhoto(false);

    await expect(
      shipmentService.updateStatus("ship-1", "CANCELLED", DRIVER)
    ).rejects.toMatchObject({ code: "CANCEL_VIA_CANCEL_ENDPOINT" });

    expect(shipmentPhotosService.hasStagePhoto).not.toHaveBeenCalled();
    expect(shipmentsDal.updateStatus).not.toHaveBeenCalled();
  });
});
