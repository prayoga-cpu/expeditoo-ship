import { afterEach, describe, expect, it, vi } from "vitest";

import { assignRole, removeRole } from "../users.api";

/**
 * `handleUpdateRole` used to send `replace: true` on every assignment,
 * silently wiping every other role the account held — one keystroke away
 * from the dialog's own copy promising the opposite ("Users can have
 * multiple roles"). Pinning the request body here is what would have caught
 * that the first time.
 */

function mockFetchOnce(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assignRole", () => {
  it("POSTs the role with no replace flag", async () => {
    const fetchMock = mockFetchOnce({
      success: true,
      data: { success: true, message: "assigned" },
    });

    await assignRole("user-1", "carrier");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/user/roles",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ userId: "user-1", role: "carrier" });
    expect(body).not.toHaveProperty("replace");
  });
});

describe("removeRole", () => {
  it("DELETEs with the user and role", async () => {
    const fetchMock = mockFetchOnce({
      success: true,
      data: { success: true, message: "removed" },
    });

    await removeRole("user-1", "carrier");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/user/roles",
      expect.objectContaining({ method: "DELETE" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ userId: "user-1", role: "carrier" });
  });

  it("surfaces the server's soft-failure message rather than throwing", async () => {
    mockFetchOnce({
      success: true,
      data: { success: false, message: "Cannot remove the user's last role" },
    });

    const result = await removeRole("user-1", "shipper");

    expect(result).toEqual({
      success: false,
      message: "Cannot remove the user's last role",
    });
  });
});
