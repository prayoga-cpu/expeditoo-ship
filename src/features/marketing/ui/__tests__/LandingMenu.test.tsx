import { existsSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import { LandingNavbar } from "../LandingNavbar";
import { MENU_SECTIONS } from "../LandingMenu";

/**
 * The full-screen menu (landing_2026_11_spec.md §1.2): a modal dialog that
 * takes focus, keeps it, gives it back, holds the page still behind it, and
 * links only to sections and routes that exist.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const auth = { isAuthenticated: false, isLoading: false };
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));

vi.mock("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ locale: "en", setLocale: vi.fn(), isLoading: false }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

const APP_DIR = join(process.cwd(), "src/app");
const pageExists = (pathname: string) =>
  ["(marketing)", "(app)/(main)", "(auth)", ""].some((group) =>
    existsSync(join(APP_DIR, group, pathname, "page.tsx"))
  );

function renderNavbar() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LandingNavbar overlay />
    </NextIntlClientProvider>
  );
}

function openMenu() {
  renderNavbar();
  const trigger = screen.getByRole("button", { name: "Open the menu" });
  fireEvent.click(trigger);
  return { trigger, menu: screen.getByRole("dialog", { name: "Menu" }) };
}

beforeEach(() => {
  auth.isAuthenticated = false;
});

afterEach(() => {
  vi.clearAllMocks();
  document.documentElement.style.overflow = "";
});

describe("the full-screen menu", () => {
  it("is closed until the three-line button is pressed", () => {
    renderNavbar();

    const trigger = screen.getByRole("button", { name: "Open the menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens as a modal dialog, takes focus and holds the page still", () => {
    const { trigger, menu } = openMenu();

    expect(menu).toHaveAttribute("aria-modal", "true");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(menu.contains(document.activeElement)).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("closes on Escape, lets the page scroll again and gives focus back", () => {
    const { trigger } = openMenu();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe("");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes from its own close button", () => {
    const { trigger } = openMenu();

    fireEvent.click(screen.getByRole("button", { name: "Close the menu" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps Tab inside: the last control wraps to the first, and back", () => {
    const { menu } = openMenu();
    const focusable = Array.from(menu.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("lists the page's sections in order, and closes when one is followed", () => {
    const { menu } = openMenu();

    const sections = within(within(menu).getByRole("navigation", { name: "On this page" })).getAllByRole("link");
    expect(sections.map((link) => link.getAttribute("href"))).toEqual(MENU_SECTIONS.map((s) => s.href));
    expect(sections[0]).toHaveTextContent("Recent requests");

    fireEvent.click(sections[2]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("links only to routes that have a page", () => {
    const { menu } = openMenu();

    const routes = Array.from(menu.querySelectorAll("a"))
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/") && !href.startsWith("/#"));
    expect(routes).toEqual(expect.arrayContaining(["/create", "/help", "/contact", "/signin", "/signup"]));
    expect(routes.filter((href) => !pageExists(href.split("?")[0]))).toEqual([]);
    expect(menu.querySelector('a[href^="http"], a[href^="mailto:"]')).toBeNull();
  });

  it("offers the carrier flow to a signed-out visitor, and the app to a signed-in one", () => {
    const { menu } = openMenu();
    expect(within(menu).getByRole("button", { name: "Become a carrier" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/signin");

    fireEvent.keyDown(document, { key: "Escape" });
    auth.isAuthenticated = true;
    fireEvent.click(screen.getByRole("button", { name: "Open the menu" }));
    const signedIn = screen.getByRole("dialog");
    expect(within(signedIn).getByRole("link", { name: "Open app" })).toHaveAttribute("href", "/home");
    expect(within(signedIn).queryByRole("button", { name: "Become a carrier" })).not.toBeInTheDocument();
  });

  it("holds the language and theme switches, the theme as two pressed-or-not buttons", () => {
    const { menu } = openMenu();

    expect(within(menu).getByRole("group", { name: "Language" })).toBeInTheDocument();
    const theme = within(menu).getByRole("group", { name: "Theme" });
    expect(within(theme).getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(within(theme).getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");
  });
});
