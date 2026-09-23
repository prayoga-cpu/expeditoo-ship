import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../messages/en.json";

import { MainLayout } from "../MainLayout";
import { AccessModeProvider } from "@/lib/access-mode-context";
import { ACTIVE_ACCESS_KEY } from "@/lib/active-access";

/**
 * The desktop sidebar used to show one static list to every account
 * regardless of role — carrier-only links like "My Trips" sat in front of a
 * plain shipper, while BottomNav.tsx already filtered its mobile list by
 * role. This pins that the two now agree, sourced from the same shared
 * access-mode-context.tsx the switcher also reads.
 */

const auth: { user: { roles: string[] } | null } = { user: null };
const replace = vi.fn();

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => ({ push: vi.fn(), replace }),
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
      <AccessModeProvider>
        <MainLayout>content</MainLayout>
      </AccessModeProvider>
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
    replace.mockClear();
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

  it("gives a driver its execution surface plus trips, not bidding tools", () => {
    auth.user = { roles: ["driver"] };
    renderWith();

    const hrefs = sidebarHrefs();
    expect(hrefs).toContain("/driver/shipments");
    expect(hrefs).toContain("/carrier/trips");
    expect(hrefs).not.toContain("/carrier/offers");
    expect(hrefs).not.toContain("/create");
  });

  // "admin" is the strongest mode an admin+shipper account resolves to by
  // default (qualifiedAccessModes puts it first), so with nothing stored yet
  // this account's *default* view is the redirect in the next test, not the
  // ordinary sidebar. This test exercises the other real case: an admin who
  // has deliberately switched to "user" mode still gets a quick way back.
  it("shows the admin-panel shortcut for an admin browsing in user mode", () => {
    auth.user = { roles: ["shipper", "admin"] };
    window.localStorage.setItem(ACTIVE_ACCESS_KEY, "user");
    renderWith();

    expect(sidebarHrefs()).toContain("/admin/expedion");
  });

  it("never shows the shortcut for a non-admin", () => {
    auth.user = { roles: ["shipper"] };
    window.localStorage.setItem(ACTIVE_ACCESS_KEY, "user");
    renderWith();

    expect(sidebarHrefs()).not.toContain("/admin/expedion");
  });

  // The actual "on admin is only admin dashboard" requirement: an admin
  // account whose resolved mode is "admin" must not render the ordinary
  // sidebar at all — it redirects into the real admin dashboard instead.
  it("redirects out to the admin dashboard instead of rendering the ordinary sidebar", () => {
    auth.user = { roles: ["shipper", "admin"] };
    // Nothing stored: resolves to "admin", the strongest qualified mode.
    renderWith();

    expect(replace).toHaveBeenCalledWith("/admin/expedion");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
