import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import { withSidebarCopy } from "@/components/layouts/__tests__/sidebar-messages";

import { AdminBottomNav } from "../AdminBottomNav";
import { AdminLayout } from "../AdminLayout";
import { ADMIN_NAV_GROUPS } from "../../nav";

const auth: { user: { roles: string[] } | null; isLoading: boolean } = {
  user: null,
  isLoading: false,
};
const countsCalls = vi.fn<(options?: { enabled?: boolean }) => void>();
const headerAccount = vi.fn<(props: { profileHref: string }) => void>();

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/withdrawals",
  useRouter: () => ({ push: vi.fn() }),
}));
// Every count set, so a hidden entry's badge would show if it were asked for.
vi.mock("../../hooks/useAdminNavCounts", () => ({
  useAdminNavCounts: (options?: { enabled?: boolean }) => {
    countsCalls(options);
    return options?.enabled === false
      ? undefined
      : { expedion: 4, awards: 2, users: 7, payments: 3, support: 5, feedback: 1 };
  },
}));
vi.mock("@/lib/use-active-access-mode", () => ({
  useActiveAccessMode: () => ({ mode: "admin", qualifiedModes: ["admin", "user"], setMode: vi.fn() }),
}));
vi.mock("@/components/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/layouts/HeaderToolbox", () => ({ HeaderToolbox: () => null }));
vi.mock("@/components/layouts/HeaderAccount", () => ({
  HeaderAccount: (props: { profileHref: string }) => {
    headerAccount(props);
    return null;
  },
}));
vi.mock("@/components/layouts/AccessSwitcher", () => ({ AccessSwitcher: () => null }));

const ALL = ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

const OPERATOR = [
  "/admin/bordereaux",
  "/admin/awards",
  "/admin/listings",
  "/admin/shipments",
  "/admin/drivers",
  "/admin/withdrawals",
  "/admin/incidents",
  "/admin/feedback",
];
const SUPPORT = ["/admin/support"];
const FINANCE = ["/admin/withdrawals", "/admin/settings"];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollTo ??= () => {};
});

function renderShell(roles: string[] | null) {
  auth.user = roles ? { roles } : null;
  render(
    <NextIntlClientProvider locale="en" messages={withSidebarCopy(en)}>
      <AdminLayout>content</AdminLayout>
    </NextIntlClientProvider>
  );
  const aside = screen.getByRole("complementary");
  const links = within(aside).getAllByRole("link");
  return {
    aside,
    // The logo link leads the sidebar; the entries follow it.
    logo: links[0].getAttribute("href"),
    sidebar: links.slice(1).map((link) => link.getAttribute("href")),
    // AdminLayout renders the phone bar too: the same list, on a phone.
    bar: screen.queryAllByRole("menuitem").map((item) => item.getAttribute("href")),
  };
}

describe("the back-office navigation, by staff role (roles_spec.md §5.1)", () => {
  it("shows an admin every entry, on both navigations", () => {
    const { sidebar, bar, logo } = renderShell(["shipper", "admin"]);

    expect(sidebar).toEqual(ALL);
    expect(bar).toEqual(ALL);
    // The logo opens the public website for every shell (client feedback
    // 2026-11-25); the staff landing is the first entry of the nav itself.
    expect(logo).toBe("/");
  });

  it.each([
    ["operator", OPERATOR, "/admin/bordereaux"],
    ["support", SUPPORT, "/admin/support"],
    ["finance", FINANCE, "/admin/withdrawals"],
  ])("shows %s only its own entries, the landing first, and a logo that opens the website", (role, hrefs, landing) => {
    const { sidebar, bar, logo } = renderShell(["shipper", role]);

    expect(sidebar).toEqual(hrefs);
    expect(bar).toEqual(hrefs);
    expect(logo).toBe("/");
    expect(sidebar[0]).toBe(landing);
  });

  it("puts no heading over a group with nothing in it", () => {
    const { aside } = renderShell(["shipper", "finance"]);

    expect(
      within(aside).getAllByRole("group").map((group) => group.getAttribute("aria-label"))
    ).toEqual(["Money", "System"]);
  });

  it("gives a multi-role account the union", () => {
    const { sidebar } = renderShell(["support", "finance"]);

    expect(sidebar).toEqual(["/admin/withdrawals", "/admin/support", "/admin/settings"]);
  });

  it.each(["support", "finance"])(
    "never asks for the badge counts as %s — the service would answer 403",
    (role) => {
      const { aside } = renderShell(["shipper", role]);

      expect(countsCalls).toHaveBeenCalled();
      for (const [options] of countsCalls.mock.calls) {
        expect(options).toEqual({ enabled: false });
      }
      expect(within(aside).queryByText(/^\d+$/)).toBeNull();
    }
  );

  it("asks for them as an operator, and badges only the entries shown", () => {
    const { aside } = renderShell(["shipper", "operator"]);

    for (const [options] of countsCalls.mock.calls) {
      expect(options).toEqual({ enabled: true });
    }
    const awards = within(aside).getByRole("link", { name: /Award/ });
    expect(within(awards).getByText("2", { selector: "[aria-hidden]" })).toBeInTheDocument();
    // Users (7), payments (3), support (5) and Supervision (4) are not on screen.
    for (const hidden of ["7", "3", "5", "4"]) {
      expect(within(aside).queryByText(hidden, { selector: "[aria-hidden]" })).toBeNull();
    }
  });

  it("shows no entry while the session is still loading", () => {
    const { sidebar, bar } = renderShell(null);

    expect(sidebar).toEqual([]);
    expect(bar).toEqual([]);
  });

  it("leads the header name to Settings only for those who may open it", () => {
    renderShell(["shipper", "finance"]);
    expect(headerAccount).toHaveBeenLastCalledWith({ profileHref: "/admin/profile" });

    cleanup();
    renderShell(["shipper", "operator"]);
    expect(headerAccount).toHaveBeenLastCalledWith({ profileHref: "/admin/bordereaux" });
  });
});

describe("AdminBottomNav on its own", () => {
  it("renders a support session one entry", () => {
    auth.user = { roles: ["shipper", "support"] };
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AdminBottomNav />
      </NextIntlClientProvider>
    );

    expect(screen.getAllByRole("menuitem").map((item) => item.getAttribute("href"))).toEqual(SUPPORT);
  });
});
