import { describe, it, expect, vi, beforeEach } from "vitest";

// Covers docs/specs/billing_documents_spec.md §4.1 and §7 — the wire from a
// delivery to its paperwork. `settleDelivery` is private, so it is driven
// through the two public paths that reach it.

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
    getForShipment: vi.fn().mockResolvedValue({ id: "pay-1" }),
    chargeForShipment: vi.fn().mockResolvedValue({}),
    schedulePayout: vi.fn().mockResolvedValue({}),
    refundForShipment: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("@/server/services/invoices.service", () => ({
  invoicesService: { createFromPayment: vi.fn().mockResolvedValue({}) },
}));
// Delivery asks the client to confirm the milestone. Unmocked, that reached a
// real Postgres and every case here died before the settlement it is about.
vi.mock("@/server/services/shipment-confirmations.service", () => ({
  shipmentConfirmationsService: {
    requestConfirmation: vi.fn().mockResolvedValue({}),
  },
}));
// `-> DELIVERED` is gated on a delivery photo existing
// (shipment_photos_spec.md §3.6). These cases are about what happens *after*
// the gate opens, so it is stubbed open; `shipment-photo-gate.test.ts` is
// where the gate itself is exercised.
vi.mock("@/server/services/shipment-photos.service", () => ({
  shipmentPhotosService: {
    hasStagePhoto: vi.fn().mockResolvedValue(true),
    stageCounts: vi.fn().mockResolvedValue({ pickup: 1, delivery: 1 }),
  },
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
  vi.mocked(paymentsService.getForShipment).mockResolvedValue({
    id: "pay-1",
    status: "captured",
  } as never);
});

describe("settlement on delivery", () => {
  it("schedules the payout and raises the invoice, taking no more money", async () => {
    await shipmentService.updateStatus("ship-1", "DELIVERED", CARRIER);

    expect(paymentsService.schedulePayout).toHaveBeenCalledWith(
      "ship-1",
      "carrier-1"
    );
    expect(invoicesService.createFromPayment).toHaveBeenCalledWith("pay-1");
    // The client paid at booking. Delivery settles the driver's half and
    // nothing else (docs/specs/payment_at_booking_spec.md §5).
    expect(paymentsService.chargeForShipment).not.toHaveBeenCalled();
  });

  it("raises exactly one invoice per delivery", async () => {
    await shipmentService.updateStatus("ship-1", "DELIVERED", CARRIER);

    expect(invoicesService.createFromPayment).toHaveBeenCalledTimes(1);
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

  it("pays nobody when the money never arrived", async () => {
    // A charge that failed at booking should have compensated the award, so a
    // delivery on an unpaid shipment is a state for support to look at — not a
    // reason to pay a driver out of a payment that was never taken.
    vi.mocked(paymentsService.getForShipment).mockResolvedValue({
      id: "pay-1",
      status: "failed",
    } as never);

    const result = await shipmentService.updateStatus(
      "ship-1",
      "DELIVERED",
      CARRIER
    );

    // The goods still arrived, so the delivery itself stands.
    expect(result).toMatchObject({ status: "DELIVERED" });
    expect(paymentsService.schedulePayout).not.toHaveBeenCalled();
    expect(invoicesService.createFromPayment).not.toHaveBeenCalled();
  });

  it("pays nobody when the shipment has no payment at all", async () => {
    vi.mocked(paymentsService.getForShipment).mockResolvedValue(
      undefined as never
    );

    const result = await shipmentService.updateStatus(
      "ship-1",
      "DELIVERED",
      CARRIER
    );

    expect(result).toMatchObject({ status: "DELIVERED" });
    expect(paymentsService.schedulePayout).not.toHaveBeenCalled();
  });

  it("settles nothing on a status that is not a delivery", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue({
      ...OWNERSHIP,
      status: "PICKED_UP",
    } as never);

    await shipmentService.updateStatus("ship-1", "IN_TRANSIT", CARRIER);

    expect(paymentsService.getForShipment).not.toHaveBeenCalled();
    expect(invoicesService.createFromPayment).not.toHaveBeenCalled();
  });
});
