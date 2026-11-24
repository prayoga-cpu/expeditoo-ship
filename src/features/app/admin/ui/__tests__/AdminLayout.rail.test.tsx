import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import { withSidebarCopy } from "@/components/layouts/__tests__/sidebar-messages";

import { AdminLayout } from "../AdminLayout";
import { ADMIN_NAV_GROUPS } from "../../nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
  useRouter: () => ({ push: vi.fn() }),
}));
// The sidebar shows what the session's roles may open; these tests are an admin's.
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { roles: ["shipper", "admin"] }, isLoading: false }),
}));
vi.mock("../../hooks/useAdminNavCounts", () => ({
  useAdminNavCounts: () => ({ users: 7 }),
}));
vi.mock("@/lib/use-active-access-mode", () => ({
  useActiveAccessMode: () => ({ mode: "admin", qualifiedModes: ["admin"], setMode: vi.fn() }),
}));
vi.mock("@/components/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/layouts/HeaderToolbox", () => ({ HeaderToolbox: () => null }));
vi.mock("@/components/layouts/HeaderAccount", () => ({ HeaderAccount: () => null }));
vi.mock("@/components/layouts/AccessSwitcher", () => ({ AccessSwitcher: () => null }));

beforeEach(() => {
  window.localStorage.clear();
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollTo ??= () => {};
});

/** The nav entries, without the logo link above them. */
const entries = (aside: HTMLElement) =>
  within(aside).getAllByRole("link").filter((link) => link.getAttribute("title") !== "Expeditop");

function renderLayout() {
  render(
    <NextIntlClientProvider locale="en" messages={withSidebarCopy(en)}>
      <AdminLayout>content</AdminLayout>
    </NextIntlClientProvider>
  );
  return screen.getByRole("complementary");
}

describe("AdminLayout sidebar rail", () => {
  it("carries every admin entry in the sidebar, rail or not", () => {
    const aside = renderLayout();
    const expected = ADMIN_NAV_GROUPS.flatMap((g) => g.items).length;
    const links = entries(aside);
    expect(links).toHaveLength(expected);

    fireEvent.click(screen.getByRole("button", { name: "Expand the menu" }));

    expect(aside).toHaveAttribute("data-rail", "off");
    expect(entries(aside)).toHaveLength(expected);
  });

  it("titles every entry for the rail, and keeps its count readable", () => {
    const aside = renderLayout();
    for (const link of entries(aside)) {
      expect(link.getAttribute("title")).toBeTruthy();
    }
    const users = within(aside).getByRole("link", { name: /Users/ });
    expect(within(users).getByText("7", { selector: "[aria-hidden]" })).toBeInTheDocument();
    expect(users).toHaveAttribute("aria-current", "page");
  });

  it("exposes the toggle with its state and target", () => {
    const aside = renderLayout();
    const toggle = screen.getByRole("button", { name: "Expand the menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", aside.id);
    expect(aside.className).toContain("lg:flex");
  });

  it("keeps <main> the relative scroller", () => {
    renderLayout();
    const main = screen.getByRole("main");
    expect(main.className).toContain("relative");
    expect(main.className).toContain("overflow-y-auto");
    expect(main.className).toContain("lg:pb-0");
  });

  // 2.96.0 #36: the sidebar was a component declared inside render, so every
  // re-render of the layout replaced every link — a click whose press and
  // release straddled one never fired.
  it("keeps the same link elements across a re-render", () => {
    const aside = renderLayout();
    const before = within(aside).getByRole("link", { name: /Users/ });

    fireEvent.click(screen.getByRole("button", { name: "Expand the menu" }));

    expect(within(aside).getByRole("link", { name: /Users/ })).toBe(before);
  });
});
