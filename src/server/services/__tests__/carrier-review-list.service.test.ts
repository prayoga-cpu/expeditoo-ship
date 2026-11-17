import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => await fn({}) },
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: { listByStatus: vi.fn() } }));
vi.mock("@/server/dal/offers.dal", () => ({ offersDal: {} }));
vi.mock("@/server/dal/shipments.dal", () => ({ shipmentsDal: {} }));
vi.mock("@/server/dal/users.dal", () => ({
  assignRoleIfMissing: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  verifyUserEmail: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }));

import { carrierService } from "../carrier.service";
import { carriersDal } from "@/server/dal/carriers.dal";

/** « Réparer l'accès » needs to know whether the owner holds the role (driver_page_management_spec.md §4). */
const row = (kind: "private" | "professional", roles: string[]) => ({
  id: `c-${kind}`,
  kind,
  user: { id: "u1", name: "Paul", email: "p@example.com", roles: roles.map((role) => ({ role })) },
});

describe("carrierService.listForReview · hasDriverAccess", () => {
  beforeEach(() => {
    vi.mocked(carriersDal.listByStatus).mockReset();
  });

  const list = async (rows: unknown[]) => {
    vi.mocked(carriersDal.listByStatus).mockResolvedValue(rows as never);
    return await carrierService.listForReview();
  };

  it("is true when an outside carrier holds the carrier role", async () => {
    const [result] = await list([row("professional", ["shipper", "carrier"])]);
    expect(result.hasDriverAccess).toBe(true);
  });

  it("is true when an in-house driver holds the driver role", async () => {
    const [result] = await list([row("private", ["shipper", "driver"])]);
    expect(result.hasDriverAccess).toBe(true);
  });

  it("is false when the owner holds only the other kind's role", async () => {
    const [outside, inHouse] = await list([
      row("professional", ["shipper", "driver"]),
      row("private", ["shipper", "carrier"]),
    ]);
    expect(outside.hasDriverAccess).toBe(false);
    expect(inHouse.hasDriverAccess).toBe(false);
  });

  it("answers the question and never ships the role rows", async () => {
    const [result] = await list([row("professional", ["carrier", "admin"])]);
    expect(result.user).not.toHaveProperty("roles");
    expect(result.user).toMatchObject({ id: "u1", name: "Paul" });
  });
});
