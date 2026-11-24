import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  deleteCredentialAccounts: vi.fn(),
  deleteUserSessions: vi.fn(),
}));

vi.mock("@/server/dal/users.dal", () => ({ getUserById: mocks.getUserById }));
vi.mock("@/server/dal/accounts.dal", () => ({
  deleteCredentialAccounts: mocks.deleteCredentialAccounts,
}));
vi.mock("@/server/dal/sessions.dal", () => ({
  deleteUserSessions: mocks.deleteUserSessions,
}));

import { guardOAuthLink } from "../oauth-link-guard.service";

/**
 * A stranger signs up with the victim's address and a password; the victim
 * later signs in with Google, which links and verifies the row. The stranger's
 * password must not survive that link.
 */
describe("guardOAuthLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteCredentialAccounts.mockResolvedValue(1);
    mocks.deleteUserSessions.mockResolvedValue(0);
  });

  it("drops an unproven password and its sessions when Google is linked", async () => {
    mocks.getUserById.mockResolvedValue({ id: "u1", emailVerified: false });

    expect(await guardOAuthLink("u1", "google")).toEqual({ droppedPassword: true });
    expect(mocks.deleteCredentialAccounts).toHaveBeenCalledWith("u1");
    expect(mocks.deleteUserSessions).toHaveBeenCalledWith("u1");
  });

  it("keeps the password of an account whose address was confirmed", async () => {
    mocks.getUserById.mockResolvedValue({ id: "u1", emailVerified: true });

    expect(await guardOAuthLink("u1", "google")).toEqual({ droppedPassword: false });
    expect(mocks.deleteCredentialAccounts).not.toHaveBeenCalled();
  });

  it("never touches the password account being created itself", async () => {
    expect(await guardOAuthLink("u1", "credential")).toEqual({ droppedPassword: false });
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("does nothing when the user row is not there yet", async () => {
    mocks.getUserById.mockResolvedValue(undefined);

    expect(await guardOAuthLink("u1", "google")).toEqual({ droppedPassword: false });
    expect(mocks.deleteCredentialAccounts).not.toHaveBeenCalled();
  });

  it("ends no session when there was no password to drop", async () => {
    mocks.getUserById.mockResolvedValue({ id: "u1", emailVerified: false });
    mocks.deleteCredentialAccounts.mockResolvedValue(0);

    expect(await guardOAuthLink("u1", "google")).toEqual({ droppedPassword: false });
    expect(mocks.deleteUserSessions).not.toHaveBeenCalled();
  });

  it("lets a database failure stop the link", async () => {
    mocks.getUserById.mockResolvedValue({ id: "u1", emailVerified: false });
    mocks.deleteCredentialAccounts.mockRejectedValue(new Error("db down"));

    await expect(guardOAuthLink("u1", "google")).rejects.toThrow("db down");
  });
});
