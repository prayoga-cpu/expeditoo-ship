import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/dal/listings.dal", () => ({
  listingsDal: { activityCounts: vi.fn() },
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

/** `GET /api/users/:id/activity` (client_feedback_2026_10_21_spec.md §D6). */
describe("listingsService.activityFor", () => {
  beforeEach(() => {
    vi.mocked(listingsDal.activityCounts)
      .mockReset()
      .mockResolvedValue({ posted: 4, taken: 1 });
  });

  it("gives a person their own figures", async () => {
    await expect(
      listingsService.activityFor({ userId: "u1" }, "u1")
    ).resolves.toEqual({ posted: 4, taken: 1 });
    expect(listingsDal.activityCounts).toHaveBeenCalledWith("u1");
  });

  it.each([
    [{ userId: "admin", isAdmin: true }],
    [{ userId: "op", isOperator: true }],
  ])("gives staff anyone's figures (%o)", async (viewer) => {
    await expect(listingsService.activityFor(viewer, "u1")).resolves.toEqual({
      posted: 4,
      taken: 1,
    });
  });

  it("refuses anyone else, before reading anything", async () => {
    const error = await listingsService
      .activityFor({ userId: "u2" }, "u1")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ListingError);
    expect(error).toMatchObject({ status: 403 });
    expect(listingsDal.activityCounts).not.toHaveBeenCalled();
  });
});
