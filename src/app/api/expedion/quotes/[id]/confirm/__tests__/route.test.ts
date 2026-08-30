import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "../route";
import { expedionDal } from "@/server/dal/expedion.dal";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { auth } from "@/lib/auth";
import * as usersDal from "@/server/dal/users.dal";

/**
 * Covers docs/specs/transport_status_confirmation_spec.md §9.1.
 *
 * Neither `expedion-auth` nor the confirmations service is mocked below the
 * DAL line, so the real credential resolution and the real ownership decision
 * both run — the route only resolves the caller and hands it down, which is
 * where that decision belongs (docs/rules.md §1.4). Only leaf DALs are
 * stubbed, which keeps the import cheap and stops Drizzle reaching for a
 * database.
 */

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

vi.mock("@/server/dal/users.dal", () => ({
  userHasRole: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("@/lib/firebase-token", () => ({
  verifyFirebaseIdToken: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/server/dal/expedion.dal", () => ({
  expedionDal: { getById: vi.fn(), getByListingId: vi.fn(), addEvent: vi.fn() },
}));

vi.mock("@/server/dal/shipments.dal", () => ({
  shipmentsDal: {
    getByListingId: vi.fn(),
    getOwnership: vi.fn(),
    createConfirmation: vi.fn(),
    getConfirmation: vi.fn(),
  },
}));

const CLIENT_KEY = "test-client-key";
const ADMIN_KEY = "test-admin-key";

const created = vi.mocked(shipmentsDal.createConfirmation);

/** A request on the shared-key path, naming `uid` as the caller. */
function post(
  body: unknown,
  { uid = "owner-1", admin = false }: { uid?: string; admin?: boolean } = {}
) {
  return POST(
    new NextRequest("http://localhost/api/expedion/quotes/q_1/confirm", {
      method: "POST",
      headers: {
        authorization: `Bearer ${admin ? ADMIN_KEY : CLIENT_KEY}`,
        "x-expedion-uid": uid,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "q_1" }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EXPEDION_API_KEY", CLIENT_KEY);
  vi.stubEnv("EXPEDION_ADMIN_API_KEY", ADMIN_KEY);
  vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
  vi.mocked(usersDal.userHasRole).mockResolvedValue(false as never);
  vi.mocked(expedionDal.getById).mockResolvedValue({
    id: "q_1",
    firebaseUid: "owner-1",
    listingId: "lst_1",
  } as never);
  vi.mocked(shipmentsDal.getByListingId).mockResolvedValue({
    id: "ship-1",
  } as never);
  vi.mocked(shipmentsDal.getOwnership).mockResolvedValue({
    id: "ship-1",
    shipperId: "shipper-1",
    carrierId: "carrier-1",
    driverId: null,
    status: "DELIVERED",
    listingId: "lst_1",
  } as never);
  vi.mocked(expedionDal.getByListingId).mockResolvedValue(undefined as never);
  created.mockResolvedValue({
    id: "conf-1",
    milestone: "DELIVERED",
    channel: "expedion_app",
    confirmedByRole: "client",
    createdAt: new Date("2026-08-29T12:00:00Z"),
  } as never);
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/expedion/quotes/:id/confirm", () => {
  it("records the confirmation for the quote's owner", async () => {
    const response = await post({ milestone: "DELIVERED" });

    expect(response.status).toBe(200);
    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: "ship-1",
        milestone: "DELIVERED",
        channel: "expedion_app",
        confirmedByRole: "client",
      })
    );
  });

  it("refuses a caller who owns a different quote", async () => {
    const response = await post({ milestone: "DELIVERED" }, { uid: "someone-else" });

    // 404, not 403: a non-owner must not learn that the quote id exists.
    expect(response.status).toBe(404);
    // Refused outright — nothing may be written on another client's transport.
    expect(created).not.toHaveBeenCalled();
  });

  it("records an admin's answer as an operator's, not the client's", async () => {
    const response = await post(
      { milestone: "PICKED_UP" },
      { uid: "operator-1", admin: true }
    );

    expect(response.status).toBe(200);
    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedByRole: "operator",
        confirmedByRef: "operator-1",
      })
    );
  });

  it("records the owner's own answer as the client's", async () => {
    await post({ milestone: "PICKED_UP" }, { uid: "owner-1", admin: true });

    // Admin *and* owner — answering for themselves is still the client.
    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({ confirmedByRole: "client" })
    );
  });

  it("never returns the audit columns to the caller", async () => {
    const response = await post({ milestone: "DELIVERED" });
    const body = await response.json();

    for (const key of ["confirmedByUserId", "confirmedByRef", "note"]) {
      expect(Object.keys(body.data.confirmation)).not.toContain(key);
    }
  });

  it("404s a quote that has never been escalated to a transport", async () => {
    vi.mocked(expedionDal.getById).mockResolvedValue({
      id: "q_1",
      firebaseUid: "owner-1",
      listingId: null,
    } as never);

    const response = await post({ milestone: "DELIVERED" });

    expect(response.status).toBe(404);
    expect(created).not.toHaveBeenCalled();
  });

  it("404s when no driver has been awarded the transport yet", async () => {
    vi.mocked(shipmentsDal.getByListingId).mockResolvedValue(
      undefined as never
    );

    const response = await post({ milestone: "PICKED_UP" });

    expect(response.status).toBe(404);
  });

  it("rejects a milestone the client is never asked to attest", async () => {
    const response = await post({ milestone: "IN_TRANSIT" });

    expect(response.status).toBe(400);
    expect(created).not.toHaveBeenCalled();
  });
});
