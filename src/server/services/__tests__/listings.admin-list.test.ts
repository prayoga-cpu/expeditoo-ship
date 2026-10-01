import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/dal/listings.dal", () => ({
  listingsDal: { adminList: vi.fn() },
}));
vi.mock("@/server/dal/shipments.dal", () => ({ shipmentsDal: {} }));
vi.mock("@/server/services/offers.service", () => ({ offersService: {} }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: {},
}));
vi.mock("@/server/services/email.service", () => ({ emailService: {} }));
vi.mock("@/server/services/carrier-route-alerts.service", () => ({
  carrierRouteAlertsService: {},
}));
vi.mock("@/server/dal/users.dal", () => ({ getUserById: vi.fn() }));
vi.mock("@/server/services/account-policy", () => ({
  isSystemAccount: () => false,
}));

import { listingsService, ListingError } from "../listings.service";
import { listingsDal } from "@/server/dal/listings.dal";

/** `GET /api/admin/listings` (request_summary_spec.md §3.1). */
describe("listingsService.adminList", () => {
  const page = { items: [{ id: "job-1", origin: "direct" }], total: 7 };

  beforeEach(() => {
    vi.mocked(listingsDal.adminList).mockReset().mockResolvedValue(page as never);
  });

  it("passes the origin filter through to the DAL", async () => {
    const filters = {
      origin: "direct" as const,
      posted: true,
      page: 1,
      limit: 5,
    };

    await expect(
      listingsService.adminList({ userId: "admin-1", isAdmin: true }, filters)
    ).resolves.toEqual(page);
    expect(listingsDal.adminList).toHaveBeenCalledWith(filters);
  });

  it("lets an operator read it too", async () => {
    await listingsService.adminList(
      { userId: "op-1", isOperator: true },
      { page: 1, limit: 50 }
    );

    expect(listingsDal.adminList).toHaveBeenCalledWith({ page: 1, limit: 50 });
  });

  it("refuses anyone who is not staff, before reading anything", async () => {
    const error = await listingsService
      .adminList({ userId: "user-1" }, { origin: "direct", page: 1, limit: 5 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ListingError);
    expect(error).toMatchObject({ code: "FORBIDDEN_ROLE", status: 403 });
    expect(listingsDal.adminList).not.toHaveBeenCalled();
  });
});
