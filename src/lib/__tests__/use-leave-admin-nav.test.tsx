import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccessModeProvider } from "@/lib/access-mode-context";
import { ACTIVE_ACCESS_KEY } from "@/lib/active-access";
import { useLeaveAdminNav } from "@/lib/use-leave-admin-nav";

/**
 * « Message » on the staff view of a profile pushed to /messages/:id without
 * leaving Admin mode, and MainLayout's guard bounced the admin straight back
 * to /admin/expedion (admin_user_management_spec.md §7.5). What is pinned
 * here is the mode in storage *at the moment of the push* — setting it after
 * would lose the same race.
 */

const auth: { user: { roles: string[] } | null } = { user: null };
let storedAtPush: string | null | undefined;
const push = vi.fn(() => {
  storedAtPush = window.localStorage.getItem(ACTIVE_ACCESS_KEY);
});

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <AccessModeProvider>{children}</AccessModeProvider>
);

function go(href = "/messages/c1") {
  const { result } = renderHook(() => useLeaveAdminNav(), { wrapper });
  act(() => result.current(href));
}

describe("useLeaveAdminNav", () => {
  beforeEach(() => {
    push.mockClear();
    storedAtPush = undefined;
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("leaves Admin mode before the push", () => {
    // Nothing stored: an admin + user account resolves to Admin.
    auth.user = { roles: ["shipper", "admin"] };

    go();

    expect(push).toHaveBeenCalledWith("/messages/c1");
    expect(storedAtPush).toBe("user");
  });

  it("lands an admin who also drives in Driver mode, its other mode", () => {
    auth.user = { roles: ["shipper", "carrier", "admin"] };
    window.localStorage.setItem(ACTIVE_ACCESS_KEY, "admin");

    go("/listing/l1");

    expect(push).toHaveBeenCalledWith("/listing/l1");
    expect(storedAtPush).toBe("carrier");
  });

  it("leaves a mode that is not Admin alone", () => {
    auth.user = { roles: ["shipper", "admin"] };
    window.localStorage.setItem(ACTIVE_ACCESS_KEY, "user");

    go();

    expect(storedAtPush).toBe("user");
  });

  it("writes nothing for a plain account, which has nowhere else to be", () => {
    auth.user = { roles: ["shipper"] };

    go();

    expect(push).toHaveBeenCalledWith("/messages/c1");
    expect(storedAtPush).toBeNull();
  });
});
