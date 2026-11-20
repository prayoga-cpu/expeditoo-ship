import { describe, it, expect, vi, beforeEach } from "vitest";

import { POST } from "../route";
import { auth } from "@/lib/auth";
import { threadOffersService } from "@/server/services/thread-offers.service";

/**
 * What the route adds to a decline: the session gate, and telling the service
 * whether the sender may be pinged. An admin inside somebody's account declines
 * in that user's name, and the carrier is not notified by someone looking.
 *
 * Covers docs/specs/thread_offer_spec.md §13.
 */
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

vi.mock("@/server/services/thread-offers.service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/server/services/thread-offers.service")
    >();
  return { ...actual, threadOffersService: { decline: vi.fn() } };
});

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const getSession = vi.mocked(auth.api.getSession);
const decline = vi.mocked(threadOffersService.decline);

const call = () =>
  POST(new Request("http://localhost/api/messages/offers/to-1/decline", { method: "POST" }), {
    params: Promise.resolve({ id: "to-1" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  decline.mockResolvedValue({ threadOffer: { id: "to-1" } } as never);
});

describe("POST /api/messages/offers/:id/decline", () => {
  it("refuses a caller with no session", async () => {
    getSession.mockResolvedValue(null as never);

    const res = await call();

    expect(res.status).toBe(401);
    expect(decline).not.toHaveBeenCalled();
  });

  it("declines for the signed-in user and lets the sender be told", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-me" },
      session: { impersonatedBy: null },
    } as never);

    const res = await call();

    expect(res.status).toBe(200);
    expect(decline).toHaveBeenCalledWith("user-me", "to-1", { notify: true });
  });

  it("pings nobody from an admin's borrowed session", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-me" },
      session: { impersonatedBy: "admin-1" },
    } as never);

    await call();

    expect(decline).toHaveBeenCalledWith("user-me", "to-1", { notify: false });
  });
});
