import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "../auth-context";
import { RETURNING_VISITOR_KEY } from "../returning-visitor";

/**
 * `AuthProvider` is the sole producer of the returning-visitor flag, and every
 * landing test mocks this module wholesale — so without this file the branch
 * that decides login-versus-signup for the entire site is never executed.
 */

const session = { data: null as unknown, isPending: false };

vi.mock("@/lib/auth-client", () => ({
  useSession: () => session,
}));

function Probe() {
  const { isAuthenticated, isLoading } = useAuth();
  return <span>{`${isAuthenticated}:${isLoading}`}</span>;
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  session.data = null;
  session.isPending = false;
});

afterEach(() => vi.clearAllMocks());

describe("AuthProvider and the returning-visitor flag", () => {
  it("marks the device once a session exists", () => {
    session.data = { user: { id: "u1" }, session: { id: "s1" } };
    renderProvider();

    expect(window.localStorage.getItem(RETURNING_VISITOR_KEY)).toBe("1");
    expect(screen.getByText("true:false")).toBeInTheDocument();
  });

  it("leaves an anonymous visitor unmarked, so they are offered signup", () => {
    renderProvider();

    expect(window.localStorage.getItem(RETURNING_VISITOR_KEY)).toBeNull();
    expect(screen.getByText("false:false")).toBeInTheDocument();
  });

  it("does not mark the device while the session is still resolving", () => {
    session.isPending = true;
    renderProvider();

    expect(window.localStorage.getItem(RETURNING_VISITOR_KEY)).toBeNull();
  });

  it("keeps the mark after the session goes away — that is the whole point", () => {
    session.data = { user: { id: "u1" }, session: { id: "s1" } };
    const { unmount } = renderProvider();
    unmount();

    session.data = null;
    renderProvider();

    expect(window.localStorage.getItem(RETURNING_VISITOR_KEY)).toBe("1");
    expect(screen.getByText("false:false")).toBeInTheDocument();
  });

  it("does not throw when storage refuses the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    session.data = { user: { id: "u1" }, session: { id: "s1" } };

    expect(() => renderProvider()).not.toThrow();
  });
});
