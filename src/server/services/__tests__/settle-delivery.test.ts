import { describe, it, expect, vi, beforeEach } from "vitest";

// Covers docs/specs/billing_documents_spec.md §4.1 and §7 — the wire from a
// delivery to its paperwork. `settleDelivery` is private, so it is driven
// through the two public paths that reach it.

vi.mock("@/server/dal/shipments.dal", () => ({
  shipmentsDal: {
    getOwnership: vi.fn(),
    updateStatus: vi.fn(),
    updateProofOfDelivery: vi.fn(),
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
    captureForShipment: vi.fn().mockResolvedValue({ id: "pay-1" }),
    schedulePayout: vi.fn().mockResolvedValue({}),
    releaseForShipment: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("@/server/services/invoices.service", () => ({
  invoicesService: { createFromPayment: vi.fn().mockResolvedValue({}) },
}));

import { shipmentService } from "../shipment.service";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { paymentsService } from "@/server/services/payments.service";
import { invoicesService } from "@/server/services/invoices.service";

const OWNERSHIP = {
  id: "ship-1",
  listingId: "job-1",
  shipperId: "shipper-1",
  carrierId: "carrier-1",
  driverId: "driver-1",
  status: "IN_TRANSIT",
};

const CARRIER = { userId: "carrier-1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(OWNERSHIP as never);
  vi.mocked(shipmentsDal.updateStatus).mockResolvedValue({
    ...OWNERSHIP,
    status: "DELIVERED",
  } as never);
  vi.mocked(shipmentsDal.updateProofOfDelivery).mockResolvedValue({
    ...OWNERSHIP,
    status: "DELIVERED",
  } as never);
  vi.mocked(paymentsService.captureForShipment).mockResolvedValue({
    id: "pay-1",
  } as never);
});

describe("settlement on delivery", () => {
  it("captures, schedules the payout, then raises the invoice", async () => {
    await shipmentService.updateStatus("ship-1", "DELIVERED", CARRIER);

    expect(paymentsService.captureForShipment).toHaveBeenCalledWith("ship-1");
    expect(paymentsService.schedulePayout).toHaveBeenCalledWith(
      "ship-1",
      "carrier-1"
    );
    expect(invoicesService.createFromPayment).toHaveBeenCalledWith("pay-1");
  });

  it("raises exactly one invoice per delivery", async () => {
    await shipmentService.updateStatus("ship-1", "DELIVERED", CARRIER);

    expect(invoicesService.createFromPayment).toHaveBeenCalledTimes(1);
  });

  it("raises the invoice on the proof-of-delivery path too", async () => {
    await shipmentService.uploadProofOfDelivery(
      "ship-1",
      "https://example.com/pod.jpg",
      CARRIER
    );

    expect(invoicesService.createFromPayment).toHaveBeenCalledWith("pay-1");
  });

  it("does not fail the delivery when the invoice write throws", async () => {
    vi.mocked(invoicesService.createFromPayment).mockRejectedValue(
      new Error("pdf storage down")
    );

    const result = await shipmentService.updateStatus(
      "ship-1",
      "DELIVERED",
      CARRIER
    );

    // The goods arrived; paperwork can be re-run.
    expect(result).toMatchObject({ status: "DELIVERED" });
    expect(paymentsService.schedulePayout).toHaveBeenCalled();
  });

  it("does not attempt an invoice when the capture itself fails", async () => {
    vi.mocked(paymentsService.captureForShipment).mockRejectedValue(
      new Error("stripe unreachable")
    );

    const result = await shipmentService.updateStatus(
      "ship-1",
      "DELIVERED",
      CARRIER
    );

    expect(result).toMatchObject({ status: "DELIVERED" });
    expect(invoicesService.createFromPayment).not.toHaveBeenCalled();
  });

  it("settles nothing on a status that is not a delivery", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue({
      ...OWNERSHIP,
      status: "PICKED_UP",
    } as never);

    await shipmentService.updateStatus("ship-1", "IN_TRANSIT", CARRIER);

    expect(paymentsService.captureForShipment).not.toHaveBeenCalled();
    expect(invoicesService.createFromPayment).not.toHaveBeenCalled();
  });
});
