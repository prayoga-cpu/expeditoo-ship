import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";

import { AdminBottomNav } from "../AdminBottomNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/expedion" }));
// The bar shows what the session's roles may open; these tests are an admin's.
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { roles: ["shipper", "admin"] }, isLoading: false }),
}));
vi.mock("../../hooks/useAdminNavCounts", () => ({ useAdminNavCounts: () => ({}) }));
Element.prototype.scrollTo ??= () => {};

const renderBar = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AdminBottomNav />
    </NextIntlClientProvider>
  );

describe("AdminBottomNav, 2.92.0", () => {
  it("writes its labels at 12px on two lines, like FloatingNav, not 10px", () => {
    renderBar();
    const label = screen.getByText("Users");
    expect(label.className).toContain("text-xs");
    expect(label.className).toContain("line-clamp-2");
    expect(label.className).not.toContain("text-[10px]");
    expect(label.className).not.toContain("whitespace-nowrap");
  });

  it("lights a tapped entry at once and drops a repeat tap", () => {
    renderBar();
    const users = screen.getByRole("menuitem", { name: /Users/ });
    const lit = (el: HTMLElement) => el.className.split(" ").includes("bg-nav-active");
    expect(lit(users)).toBe(false);

    fireEvent.click(users);

    expect(lit(users)).toBe(true);
    expect(lit(screen.getByRole("menuitem", { name: /Expedion bridge/ }))).toBe(false);
    expect(fireEvent.click(users)).toBe(false);
  });

  it("is hidden from lg, where the sidebar takes over", () => {
    renderBar();
    expect(screen.getByRole("navigation").className).toContain("lg:hidden");
  });
});
