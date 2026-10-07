import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccessModeProvider } from "@/lib/access-mode-context";
import { ACTIVE_ACCESS_KEY } from "@/lib/active-access";
import { useApplicationNav } from "@/lib/use-application-nav";

/**
 * « Ajouter l'accès transporteur » pushed to /carrier/application without
 * leaving Admin mode, and MainLayout's guard bounced the page straight back
 * to /admin/expedion (become_driver_spec.md §1.1). What is pinned here is the
 * mode in storage *at the moment of the push* — setting it after would lose
 * the same race.
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

function go() {
  const { result } = renderHook(() => useApplicationNav(), { wrapper });
  act(() => result.current());
}

describe("useApplicationNav", () => {
  beforeEach(() => {
    push.mockClear();
    storedAtPush = undefined;
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("leaves Admin mode before the push for an account that cannot drive yet", () => {
    // Nothing stored: an admin + user account resolves to Admin.
    auth.user = { roles: ["shipper", "admin"] };

    go();

    expect(push).toHaveBeenCalledWith("/carrier/application");
    expect(storedAtPush).toBe("user");
  });

  it("never stores Driver mode for an account that does not qualify for it", () => {
    auth.user = { roles: ["shipper", "admin"] };

    go();

    expect(window.localStorage.getItem(ACTIVE_ACCESS_KEY)).not.toBe("carrier");
  });

  it("switches a driver-qualified account to Driver mode first", () => {
    auth.user = { roles: ["shipper", "carrier", "driver", "admin"] };

    go();

    expect(storedAtPush).toBe("carrier");
  });

  it("leaves a user-mode account's mode alone", () => {
    auth.user = { roles: ["shipper", "admin"] };
    window.localStorage.setItem(ACTIVE_ACCESS_KEY, "user");

    go();

    expect(storedAtPush).toBe("user");
  });

  it("writes nothing for a plain account, which has nowhere else to be", () => {
    auth.user = { roles: ["shipper"] };

    go();

    expect(push).toHaveBeenCalledWith("/carrier/application");
    expect(storedAtPush).toBeNull();
  });
});
