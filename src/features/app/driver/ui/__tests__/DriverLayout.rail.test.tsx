import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import { withSidebarCopy } from "@/components/layouts/__tests__/sidebar-messages";

import { DriverLayout } from "../DriverLayout";

vi.mock("next/navigation", () => ({
  usePathname: () => "/driver/shipments",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/features/app/messages/hooks", () => ({
  useUnreadMessages: () => ({ unreadCount: 0 }),
}));
vi.mock("@/lib/use-active-access-mode", () => ({
  useActiveAccessMode: () => ({ mode: "carrier", qualifiedModes: ["carrier"], setMode: vi.fn() }),
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
});

function renderLayout() {
  render(
    <NextIntlClientProvider locale="en" messages={withSidebarCopy(en)}>
      <DriverLayout>content</DriverLayout>
    </NextIntlClientProvider>
  );
  return screen.getByRole("complementary");
}

describe("DriverLayout sidebar rail", () => {
  it("keeps all four entries and the way back when toggled", () => {
    const aside = renderLayout();
    const hrefs = () =>
      within(aside)
        .getAllByRole("link")
        .filter((link) => link.getAttribute("title") !== "Expeditop")
        .map((link) => link.getAttribute("href"));
    const before = hrefs();
    expect(before).toEqual([
      "/driver/dashboard",
      "/driver/shipments",
      "/driver/messages",
      "/driver/profile",
    ]);
    expect(within(aside).getByRole("button", { name: "Back to App" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand the menu" }));

    expect(aside).toHaveAttribute("data-rail", "off");
    expect(hrefs()).toEqual(before);
  });

  it("wires the toggle to the sidebar and shows the sidebar from lg", () => {
    const aside = renderLayout();
    const toggle = screen.getByRole("button", { name: "Expand the menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", aside.id);
    expect(aside.className).toContain("lg:flex");
    expect(aside.className).not.toContain("xl:flex");
  });

  it("marks the current entry and keeps <main> relative", () => {
    const aside = renderLayout();
    expect(within(aside).getByRole("link", { name: "Shipments" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("main").className).toContain("relative");
  });
});
