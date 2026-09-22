import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../messages/en.json";

import { MainLayout } from "../MainLayout";

/**
 * The desktop sidebar used to show one static list to every account
 * regardless of role — carrier-only links like "My Trips" sat in front of a
 * plain shipper, while BottomNav.tsx already filtered its mobile list by
 * role. This pins that the two now agree, sourced from the same
 * use-active-access-mode.ts the switcher also reads.
 */

const auth: { user: { roles: string[] } | null } = { user: null };

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/features/app/messages/hooks", () => ({
  useUnreadMessages: () => ({ unreadCount: 0 }),
}));
vi.mock("../../NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/features/app/feedback/ui", () => ({ FeedbackLauncher: () => null }));
vi.mock("../HeaderQuickActions", () => ({ HeaderQuickActions: () => null }));
vi.mock("../../ui/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../ui/lang-toggle", () => ({ LangToggle: () => null }));

function renderWith() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MainLayout>content</MainLayout>
    </NextIntlClientProvider>
  );
}

const sidebarHrefs = () =>
  screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"))
    .filter((href): href is string => href !== null);

describe("MainLayout sidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("gives a plain account the posting tools, not carrier tools", () => {
    auth.user = { roles: ["shipper"] };
    renderWith();

    const hrefs = sidebarHrefs();
    expect(hrefs).toContain("/create");
    expect(hrefs).toContain("/listings/me");
    expect(hrefs).not.toContain("/carrier/trips");
    expect(hrefs).not.toContain("/carrier/offers");
  });

  it("gives an approved carrier the bidding tools, not the posting form", () => {
    auth.user = { roles: ["carrier"] };
    renderWith();

    const hrefs = sidebarHrefs();
    expect(hrefs).toContain("/carrier/offers");
    expect(hrefs).toContain("/carrier/trips");
    expect(hrefs).toContain("/carrier/withdrawals");
    expect(hrefs).not.toContain("/create");
  });

  it("gives a driver its execution surface, not bidding tools", () => {
    auth.user = { roles: ["driver"] };
    renderWith();

    const hrefs = sidebarHrefs();
    expect(hrefs).toContain("/driver/shipments");
    expect(hrefs).not.toContain("/carrier/offers");
    expect(hrefs).not.toContain("/create");
  });

  it("shows the admin panel entry only for an admin", () => {
    auth.user = { roles: ["shipper"] };
    const { rerender } = renderWith();
    expect(sidebarHrefs()).not.toContain("/admin/expedion");

    auth.user = { roles: ["shipper", "admin"] };
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <MainLayout>content</MainLayout>
      </NextIntlClientProvider>
    );
    expect(sidebarHrefs()).toContain("/admin/expedion");
  });
});
