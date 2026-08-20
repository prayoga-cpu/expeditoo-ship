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
}) {
  return {
    user: { id: options.id ?? "user-1", emailVerified: options.emailVerified },
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

describe("isImpersonated", () => {
  it("recognises a borrowed session and nothing else", async () => {
    const { isImpersonated } = await import("@/lib/impersonation-guard");

    expect(isImpersonated({ session: { impersonatedBy: "admin-1" } })).toBe(true);
    expect(isImpersonated({ session: { impersonatedBy: null } })).toBe(false);
    expect(isImpersonated({ session: {} })).toBe(false);
    expect(isImpersonated(null)).toBe(false);
  });
});
