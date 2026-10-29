import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/dal/shipments.dal", () => ({
  shipmentsDal: { adminOverview: vi.fn() },
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: {} }));
vi.mock("@/server/dal/listings.dal", () => ({ listingsDal: {} }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: {},
}));
vi.mock("@/server/services/expedion-bridge.service", () => ({
  notifyExpedion: vi.fn(),
}));
vi.mock("@/server/services/shipment-photos.service", () => ({
  shipmentPhotosService: {},
}));
vi.mock("@/server/services/shipment-confirmations.service", () => ({
  shipmentConfirmationsService: {},
}));
vi.mock("@/server/services/payments.service", () => ({ paymentsService: {} }));
vi.mock("@/server/services/invoices.service", () => ({ invoicesService: {} }));
vi.mock("@/server/dal/users.dal", () => ({ getUserById: vi.fn() }));
vi.mock("@/server/services/email.service", () => ({ emailService: {} }));

import { shipmentService, ShipmentError } from "../shipment.service";
import { shipmentsDal } from "@/server/dal/shipments.dal";

/** The admin « Expéditions » table (client_feedback_2026_10_21_spec.md §A5). */
describe("shipmentService.adminOverview", () => {
  const created = new Date("2026-10-20T10:00:00.000Z");
  const row = (over: Record<string, unknown> = {}) => ({
    id: "shp_1",
    status: "ASSIGNED",
    priceCents: 21_000,
    pickupAddress: "24 rue de la République, Lyon",
    dropoffAddress: "12 quai du Port, Marseille",
    createdAt: created,
    listing: {
      id: "job_1",
      title: "Bureau plat",
      reference: 100004,
      pickupCity: "Lyon",
      dropoffCity: "Marseille",
      shipper: { name: "Nicolas Denis" },
    },
    carrier: { id: "c1", name: "Jean Transport" },
    driver: null,
    ...over,
  });

  beforeEach(() => {
    vi.mocked(shipmentsDal.adminOverview).mockReset();
  });

  it("names who is driving: the assigned driver first", async () => {
    vi.mocked(shipmentsDal.adminOverview).mockResolvedValue([
      row({ driver: { id: "d1", name: "Paul Chauffeur" } }),
    ] as never);

    const [shipment] = await shipmentService.adminOverview({ userId: "a", isAdmin: true });
    expect(shipment.driverName).toBe("Paul Chauffeur");
  });

  it("falls back to the transporter who won it", async () => {
    vi.mocked(shipmentsDal.adminOverview).mockResolvedValue([row()] as never);

    const [shipment] = await shipmentService.adminOverview({ userId: "o", isOperator: true });
    expect(shipment).toEqual({
      id: "shp_1",
      status: "ASSIGNED",
      priceCents: 21_000,
      createdAt: created,
      pickupAddress: "24 rue de la République, Lyon",
      dropoffAddress: "12 quai du Port, Marseille",
      listing: {
        id: "job_1",
        title: "Bureau plat",
        reference: 100004,
        pickupCity: "Lyon",
        dropoffCity: "Marseille",
        // The requester by name only (client_feedback_2026_10_29_spec.md §A4).
        requesterName: "Nicolas Denis",
      },
      driverName: "Jean Transport",
    });
  });

  it("says nobody when nobody is named", async () => {
    vi.mocked(shipmentsDal.adminOverview).mockResolvedValue([
      row({ carrier: null, driver: null, listing: null }),
    ] as never);

    const [shipment] = await shipmentService.adminOverview({ userId: "a", isAdmin: true });
    expect(shipment.driverName).toBeNull();
    expect(shipment.listing).toBeNull();
  });

  it("refuses anyone who is not staff, before reading anything", async () => {
    const error = await shipmentService
      .adminOverview({ userId: "u1" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ShipmentError);
    expect(error).toMatchObject({ status: 403 });
    expect(shipmentsDal.adminOverview).not.toHaveBeenCalled();
  });
});
