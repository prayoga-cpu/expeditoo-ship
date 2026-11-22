import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { auth } from "@/lib/auth";
import * as usersDAL from "@/server/dal/users.dal";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/server/dal/users.dal", () => ({
  getUserById: vi.fn(),
}));

const getSession = vi.mocked(auth.api.getSession);

function request(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function session(options: {
  emailVerified: boolean;
  impersonatedBy?: string | null;
  id?: string;
  email?: string;
}) {
  return {
    user: {
      id: options.id ?? "user-1",
      emailVerified: options.emailVerified,
      email: options.email ?? "jean@mail.com",
    },
    session: { impersonatedBy: options.impersonatedBy ?? null },
  };
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersDAL.getUserById).mockResolvedValue({
      id: "user-1",
      roles: [{ role: "driver" }],
    } as never);
  });

  it("sends an unauthenticated caller to signin", async () => {
    getSession.mockResolvedValue(null as never);

    const response = await proxy(request("/home"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/signin");
  });

  it("walls an unverified user off the app", async () => {
    getSession.mockResolvedValue(session({ emailVerified: false }) as never);

    const response = await proxy(request("/home"));

    expect(response.headers.get("location")).toContain("/verify-email");
  });

  // The verify screen's resend button needs the address. Without it the page
  // asked the person to type an email the session already held.
  it("hands the verify screen the session's address, encoded", async () => {
    getSession.mockResolvedValue(
      session({ emailVerified: false, email: "jean+test@mail.com" }) as never
    );

    const response = await proxy(request("/home"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/verify-email");
    expect(location.search).toBe("?email=jean%2Btest%40mail.com");
    expect(location.searchParams.get("email")).toBe("jean+test@mail.com");
  });

  it("never writes an address it does not have into the URL", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", emailVerified: false },
      session: { impersonatedBy: null },
    } as never);

    const response = await proxy(request("/home"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/verify-email");
    expect(location.searchParams.has("email")).toBe(false);
  });

  it("leaves the verify screen itself alone, so the redirect cannot loop", async () => {
    getSession.mockResolvedValue(session({ emailVerified: false }) as never);

    const response = await proxy(
      request("/verify-email?email=jean%40mail.com")
    );

    expect(response.headers.get("location")).toBeNull();
  });

  it("lets an impersonated session past the verification wall", async () => {
    // The whole point of impersonation: an admin cannot click a link in
    // somebody else's inbox, so an unverified account was unviewable.
    getSession.mockResolvedValue(
      session({ emailVerified: false, impersonatedBy: "admin-1" }) as never
    );

    const response = await proxy(request("/home"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("still walls that same user off when they sign in themselves", async () => {
    getSession.mockResolvedValue(
      session({ emailVerified: false, impersonatedBy: null }) as never
    );

    const response = await proxy(request("/profile"));

    expect(response.headers.get("location")).toContain("/verify-email");
  });

  it("keeps the admin panel closed to a borrowed session", async () => {
    // The borrowed session carries the target's roles, so the existing admin
    // check rejects it without needing a rule of its own.
    getSession.mockResolvedValue(
      session({ emailVerified: true, impersonatedBy: "admin-1" }) as never
    );

    const response = await proxy(request("/admin/users"));

    expect(response.headers.get("location")).toContain("/home");
  });

  it("lets a verified user through", async () => {
    getSession.mockResolvedValue(session({ emailVerified: true }) as never);

    const response = await proxy(request("/home"));

    expect(response.headers.get("location")).toBeNull();
  });
});

/** Where the proxy sent the caller, or null when it let them through. */
async function visit(path: string, roles: string[]) {
  getSession.mockResolvedValue(session({ emailVerified: true }) as never);
  vi.mocked(usersDAL.getUserById).mockResolvedValue({
    id: "user-1",
    roles: roles.map((role) => ({ role })),
  } as never);

  const response = await proxy(request(path));
  const location = response.headers.get("location");
  if (!location) return null;
  const url = new URL(location);
  return `${url.pathname}${url.search}`;
}

// roles_spec.md §5.1. The proxy admitted `admin` alone while the switcher
// offered Admin mode to all four staff roles, so three of them were bounced
// to /home by the very switch they were shown.
describe("proxy: the back office, by staff role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens every page to an admin", async () => {
    for (const path of [
      "/admin/expedion",
      "/admin/users",
      "/admin/payments",
      "/admin/settings",
      "/admin/support/c1",
      "/admin/not-a-page-yet",
    ]) {
      expect([path, await visit(path, ["shipper", "admin"])]).toEqual([path, null]);
    }
  });

  it.each([
    ["operator", "/admin/bordereaux"],
    ["operator", "/admin/awards"],
    ["operator", "/admin/listings?id=l1"],
    ["operator", "/admin/shipments"],
    ["operator", "/admin/drivers?tab=applications"],
    ["operator", "/admin/applications"],
    ["operator", "/admin/withdrawals"],
    ["operator", "/admin/incidents"],
    ["operator", "/admin/feedback"],
    ["support", "/admin/support"],
    ["support", "/admin/users/u1/activity?tab=messages"],
    ["finance", "/admin/withdrawals"],
    ["finance", "/admin/settings"],
    ["finance", "/admin/profile"],
  ])("lets %s into %s", async (role, path) => {
    expect(await visit(path, ["shipper", role])).toBeNull();
  });

  it.each([
    ["operator", "/admin/expedion", "/admin/bordereaux"],
    ["operator", "/admin", "/admin/bordereaux"],
    ["operator", "/admin/users", "/admin/bordereaux"],
    ["operator", "/admin/payments", "/admin/bordereaux"],
    ["operator", "/admin/settings", "/admin/bordereaux"],
    ["operator", "/admin/support", "/admin/bordereaux"],
    ["support", "/admin/expedion", "/admin/support"],
    ["support", "/admin/users", "/admin/support"],
    ["support", "/admin/awards", "/admin/support"],
    ["support", "/admin/withdrawals", "/admin/support"],
    ["finance", "/admin/expedion", "/admin/withdrawals"],
    ["finance", "/admin/payments", "/admin/withdrawals"],
    ["finance", "/admin/users/u1/activity", "/admin/withdrawals"],
    ["finance", "/admin/drivers", "/admin/withdrawals"],
  ])("sends %s from %s to its own first page, %s", async (role, path, landing) => {
    expect(await visit(path, ["shipper", role])).toBe(landing);
  });

  it("drops the refused page's query on the way to the landing", async () => {
    expect(await visit("/admin/expedion?quote=q1", ["operator"])).toBe("/admin/bordereaux");
  });

  it("fails closed on a page nobody classified", async () => {
    expect(await visit("/admin/not-a-page-yet", ["operator"])).toBe("/admin/bordereaux");
    expect(await visit("/admin/not-a-page-yet", ["support"])).toBe("/admin/support");
    expect(await visit("/admin/not-a-page-yet", ["finance"])).toBe("/admin/withdrawals");
  });

  it.each([[["shipper"]], [["shipper", "carrier"]], [["driver"]], [[]]])(
    "still sends a non-staff account (%j) home",
    async (roles) => {
      expect(await visit("/admin/bordereaux", roles)).toBe("/home");
      expect(await visit("/admin", roles)).toBe("/home");
    }
  );

  it("never redirects a staff member to the page it is refusing", async () => {
    // A landing the account could not open would loop.
    for (const role of ["operator", "support", "finance"]) {
      const landing = await visit("/admin/expedion", [role]);
      expect(landing).not.toBeNull();
      expect(await visit(landing!, [role])).toBeNull();
    }
  });

  it("reads the roles on every request, so a revoked role closes the door at once", async () => {
    expect(await visit("/admin/awards", ["operator"])).toBeNull();
    expect(await visit("/admin/awards", ["shipper"])).toBe("/home");
    // One read per request: nothing is cached between the two.
    expect(usersDAL.getUserById).toHaveBeenCalledTimes(2);
  });

  it("sends everyone home when the roles cannot be read", async () => {
    getSession.mockResolvedValue(session({ emailVerified: true }) as never);
    vi.mocked(usersDAL.getUserById).mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await proxy(request("/admin/awards"));

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/home");
    spy.mockRestore();
  });

  it("gives a borrowed session exactly the target's back office, never the admin's", async () => {
    getSession.mockResolvedValue(
      session({ emailVerified: true, impersonatedBy: "admin-1" }) as never
    );
    vi.mocked(usersDAL.getUserById).mockResolvedValue({
      id: "user-1",
      roles: [{ role: "support" }],
    } as never);

    const refused = await proxy(request("/admin/users"));
    const allowed = await proxy(request("/admin/support"));

    expect(new URL(refused.headers.get("location") ?? "").pathname).toBe("/admin/support");
    expect(allowed.headers.get("location")).toBeNull();
  });
});

describe("isImpersonated", () => {
  it("recognises a borrowed session and nothing else", async () => {
    const { isImpersonated } = await import("@/lib/impersonation-guard");

    expect(isImpersonated({ session: { impersonatedBy: "admin-1" } })).toBe(true);
    expect(isImpersonated({ session: { impersonatedBy: null } })).toBe(false);
    expect(isImpersonated({ session: {} })).toBe(false);
    expect(isImpersonated(null)).toBe(false);
  });
});
