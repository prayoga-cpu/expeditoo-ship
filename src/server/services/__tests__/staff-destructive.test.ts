import { beforeEach, describe, expect, it, vi } from "vitest";

import * as usersDal from "@/server/dal/users.dal";
import * as adminDal from "@/server/dal/admin.dal";
import * as sessionsDal from "@/server/dal/sessions.dal";
import * as impersonationDal from "@/server/dal/impersonation.dal";

import * as adminService from "../admin.service";
import * as impersonationService from "../impersonation.service";
import * as userService from "../user.service";

/**
 * roles_spec.md §5.1 opened the back office to `operator`, `support` and
 * `finance`. What they may *see* is admin-access.ts; what they may *do* is
 * each service's, and the destructive acts stay an admin's. This holds that
 * line from the service side, where no page guard can be relied on.
 */

vi.mock("@/server/dal/users.dal", () => ({
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  deleteUser: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
  getUserRoles: vi.fn(),
}));
vi.mock("@/server/dal/admin.dal", () => ({ updateUserBannedStatus: vi.fn() }));
vi.mock("@/server/dal/sessions.dal", () => ({ deleteUserSessions: vi.fn() }));
vi.mock("@/server/dal/impersonation.dal", () => ({
  recordStart: vi.fn(),
  recordEnd: vi.fn(),
  listRecent: vi.fn(),
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: {} }));
vi.mock("@/server/services/carrier.service", () => ({
  carrierService: {},
  CarrierError: class CarrierError extends Error {},
}));

const TARGET = { id: "target", email: "driver@expeditop.test", roles: [{ role: "driver" }] };

function actAs(role: string) {
  const actor = { id: "actor", email: "staff@expeditop.test", roles: [{ role: "shipper" }, { role }] };
  vi.mocked(usersDal.getUserById).mockImplementation(async (id: string) =>
    (id === "actor" ? actor : TARGET) as never
  );
}

const STAFF_BUT_NOT_ADMIN = ["operator", "support", "finance"] as const;

describe.each(STAFF_BUT_NOT_ADMIN)("a %s account", (role) => {
  beforeEach(() => {
    vi.clearAllMocks();
    actAs(role);
  });

  it("cannot log in as another user, nor read the impersonation log", async () => {
    await expect(
      impersonationService.assertCanImpersonate("actor", "target")
    ).rejects.toMatchObject({ code: "NOT_ADMIN", status: 403 });
    await expect(impersonationService.listRecent("actor")).rejects.toMatchObject({ status: 403 });
    expect(impersonationDal.recordStart).not.toHaveBeenCalled();
  });

  it("cannot grant or remove a role", async () => {
    await expect(
      userService.assignRole({ userId: "target", role: "admin" }, "actor")
    ).rejects.toThrow(/Admin role required/);
    await expect(
      userService.removeRole({ userId: "target", role: "driver" }, "actor")
    ).rejects.toThrow(/Admin role required/);
    expect(usersDal.assignRole).not.toHaveBeenCalled();
    expect(usersDal.removeRole).not.toHaveBeenCalled();
  });

  it("cannot read the user list", async () => {
    await expect(userService.getUsers({}, "actor")).rejects.toThrow(/Admin role required/);
  });

  it("cannot delete an account", async () => {
    await expect(adminService.deleteUserAccount("target", "actor")).rejects.toMatchObject({
      code: "NOT_ADMIN",
      status: 403,
    });
    expect(usersDal.deleteUser).not.toHaveBeenCalled();
  });

  it("cannot suspend an account, sign it out everywhere or reset its password", async () => {
    await expect(adminService.updateUserStatus("target", true, "actor")).rejects.toMatchObject({
      code: "NOT_ADMIN",
    });
    await expect(adminService.revokeUserSessions("target", "actor")).rejects.toMatchObject({
      code: "NOT_ADMIN",
    });
    await expect(adminService.sendPasswordResetForUser("target", "actor")).rejects.toMatchObject({
      code: "NOT_ADMIN",
    });
    expect(adminDal.updateUserBannedStatus).not.toHaveBeenCalled();
    expect(sessionsDal.deleteUserSessions).not.toHaveBeenCalled();
  });
});
