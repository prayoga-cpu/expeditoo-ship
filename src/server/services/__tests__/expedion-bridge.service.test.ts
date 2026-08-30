import { describe, it, expect, vi, beforeEach } from "vitest";

import { expedionBridgeService } from "../expedion-bridge.service";
import { expedionDal } from "@/server/dal/expedion.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { expedionSmsService } from "@/server/services/expedion-sms.service";

/**
 * The return leg: an award on Expeditoo landing on the Expedion quote.
 *
 * The regression these exist for is an id-space crossing.
 * `offers.carrier_id` and `shipments.carrier_id` reference `user.id`, but
 * `expedion_quotes.assigned_carrier_id` references `carriers.id`.
 * `onOfferAccepted` passed the offer's user id straight through, so every
 * award of an escalated job raised a foreign-key violation inside the
 * write-back — which `notifyExpedion` swallows by design. The award succeeded,
 * the client was never told which carrier won, and the quote sat at
 * `escalated` for good. No dev row had ever been escalated *and* awarded,
 * which is why it never surfaced.
 */

vi.mock("@/server/dal/expedion.dal", () => ({
  expedionDal: {
    getByListingId: vi.fn(),
    update: vi.fn(),
    addEvent: vi.fn(),
  },
}));

vi.mock("@/server/dal/carriers.dal", () => ({
  carriersDal: { getByUserId: vi.fn() },
}));

vi.mock("@/server/services/expedion-sms.service", () => ({
  expedionSmsService: {
    driverAssigned: vi.fn().mockResolvedValue(undefined),
    deliveryUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/server/services/expedion-realtime.service", () => ({
  notifyExpedionAdmins: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db", () => ({
  db: { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
}));

const getQuote = vi.mocked(expedionDal.getByListingId);
const getCarrierByUser = vi.mocked(carriersDal.getByUserId);
const updateMock = vi.mocked(expedionDal.update);

/** An escalated quote waiting to learn who won it. */
const escalatedQuote = (over: Record<string, unknown> = {}) => ({
  id: "q_1",
  status: "escalated",
  assignedCarrierId: null,
  phone: "+33600000000",
  firstName: "Ada",
  pickupCity: "Lyon",
  bordereauNumber: "B-77",
  ...over,
});

function lastPatch(): Record<string, unknown> {
  return updateMock.mock.calls.at(-1)![1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockImplementation(
    async (_id, patch) => ({ ...escalatedQuote(), ...patch }) as never
  );
});

describe("expedionBridgeService.writeBack — carrier ids", () => {
  it("resolves the offer's user id to the carrier row the column references", async () => {
    getQuote.mockResolvedValue(escalatedQuote() as never);
    getCarrierByUser.mockResolvedValue({ id: "car_1" } as never);

    await expedionBridgeService.writeBack({
      listingId: "lst_1",
      status: "assigned",
      carrierId: "usr_driver",
    });

    expect(getCarrierByUser).toHaveBeenCalledWith("usr_driver");
    expect(lastPatch()).toMatchObject({ assignedCarrierId: "car_1" });
    expect(lastPatch().assignedAt).toBeInstanceOf(Date);
  });

  // This runs downstream of an award that has already happened. Refusing to
  // record it would lose the status change as well as the driver.
  it("records the status change when no carrier row matches", async () => {
    getQuote.mockResolvedValue(escalatedQuote() as never);
    getCarrierByUser.mockResolvedValue(undefined as never);

    await expect(
      expedionBridgeService.writeBack({
        listingId: "lst_1",
        status: "assigned",
        carrierId: "usr_ghost",
      })
    ).resolves.toBeDefined();

    expect(lastPatch()).toMatchObject({ status: "assigned" });
    expect(lastPatch()).not.toHaveProperty("assignedCarrierId");
    expect(
      vi.mocked(expedionDal.addEvent).mock.calls.at(-1)![0].metadata
    ).toMatchObject({ carrierUserId: "usr_ghost", carrierRowMissing: true });
  });

  it("puts both ids on the timeline so support can follow either", async () => {
    getQuote.mockResolvedValue(escalatedQuote() as never);
    getCarrierByUser.mockResolvedValue({ id: "car_1" } as never);

    await expedionBridgeService.writeBack({
      listingId: "lst_1",
      status: "assigned",
      carrierId: "usr_driver",
    });

    const event = vi.mocked(expedionDal.addEvent).mock.calls.at(-1)![0];
    expect(event.actorId).toBe("usr_driver");
    expect(event.metadata).toMatchObject({
      listingId: "lst_1",
      carrierUserId: "usr_driver",
    });
  });

  it("never looks up a carrier when the write-back names none", async () => {
    getQuote.mockResolvedValue(escalatedQuote({ status: "assigned" }) as never);

    await expedionBridgeService.writeBack({
      listingId: "lst_1",
      status: "picked_up",
    });

    expect(getCarrierByUser).not.toHaveBeenCalled();
    expect(lastPatch()).not.toHaveProperty("assignedCarrierId");
  });

  it("is a 404 for a listing with no quote behind it", async () => {
    getQuote.mockResolvedValue(undefined as never);

    await expect(
      expedionBridgeService.writeBack({ listingId: "lst_x", status: "assigned" })
    ).rejects.toMatchObject({ code: "QUOTE_NOT_FOUND", status: 404 });
  });

  it("refuses a transition the quote's lifecycle does not allow", async () => {
    getQuote.mockResolvedValue(escalatedQuote({ status: "delivered" }) as never);

    await expect(
      expedionBridgeService.writeBack({ listingId: "lst_1", status: "assigned" })
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION", status: 409 });
  });
});

describe("expedionBridgeService.onOfferAccepted", () => {
  it("is a no-op for a direct listing with no quote linked", async () => {
    getQuote.mockResolvedValue(undefined as never);

    await expect(
      expedionBridgeService.onOfferAccepted({
        listingId: "lst_direct",
        carrierId: "usr_driver",
      })
    ).resolves.toBeUndefined();

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("carries the winning driver onto the quote", async () => {
    getQuote.mockResolvedValue(escalatedQuote() as never);
    getCarrierByUser.mockResolvedValue({ id: "car_1" } as never);

    await expedionBridgeService.onOfferAccepted({
      listingId: "lst_1",
      carrierId: "usr_driver",
      priceCents: 10_000,
    });

    expect(lastPatch()).toMatchObject({
      status: "assigned",
      assignedCarrierId: "car_1",
    });
  });
});

/**
 * The client's confirmation link rides on the SMS the bridge already sends.
 * Covers docs/specs/transport_status_confirmation_spec.md §8 and §12.
 */
describe("expedionBridgeService — the confirmation link on the SMS", () => {
  const CONFIRM_URL = "https://app.example.com/confirm/tok_1";

  it("appends the link to the pickup SMS rather than sending a second one", async () => {
    getQuote.mockResolvedValue(escalatedQuote({ status: "assigned" }) as never);

    await expedionBridgeService.onShipmentStatus({
      listingId: "lst_1",
      shipmentStatus: "PICKED_UP",
      confirmUrl: CONFIRM_URL,
    });

    expect(expedionSmsService.deliveryUpdate).toHaveBeenCalledTimes(1);
    expect(expedionSmsService.deliveryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "picked_up", confirmUrl: CONFIRM_URL })
    );
  });

  it("sends the pickup link once across the PICKED_UP → IN_TRANSIT pair", async () => {
    // Both shipment states map onto the quote's single `picked_up` stage, and
    // the bridge refuses to re-report a status the quote already holds — so
    // the client is asked exactly once, not twice for one event.
    getQuote.mockResolvedValue(escalatedQuote({ status: "picked_up" }) as never);

    await expedionBridgeService.onShipmentStatus({
      listingId: "lst_1",
      shipmentStatus: "IN_TRANSIT",
      confirmUrl: CONFIRM_URL,
    });

    expect(expedionSmsService.deliveryUpdate).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("still sends the update when no link could be minted", async () => {
    getQuote.mockResolvedValue(escalatedQuote({ status: "picked_up" }) as never);

    await expedionBridgeService.onShipmentStatus({
      listingId: "lst_1",
      shipmentStatus: "DELIVERED",
    });

    expect(expedionSmsService.deliveryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "delivered", confirmUrl: undefined })
    );
  });
});
