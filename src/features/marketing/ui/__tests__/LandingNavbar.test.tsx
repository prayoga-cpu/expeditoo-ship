import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import { LandingNavbar } from "../LandingNavbar";

/**
 * Client feedback of 19 Nov 2026, #27: below 640px the header showed no
 * « Connexion » at all and no « Inscription » anywhere. Tailwind's classes are
 * what decide which control a width gets, and jsdom has no layout, so the
 * visible set at each width is read from them.
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

function renderNavbar(locale: "en" | "fr" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : fr}>
      <LandingNavbar />
    </NextIntlClientProvider>
  );
}

/** Which widths an element shows at, from the display utilities it carries. */
function visibleFrom(element: HTMLElement) {
  const classes = element.className.split(/\s+/);
  return {
    phone: !classes.includes("hidden"),
    desktop: !classes.includes("sm:hidden"),
  };
}

beforeEach(() => {
  auth.isAuthenticated = false;
  auth.isLoading = false;
});

afterEach(() => vi.clearAllMocks());

describe("LandingNavbar, signed out", () => {
  it("shows one « Log in / Sign up » control on a phone, straight to /signin", () => {
    renderNavbar();

    const combined = screen.getByRole("link", { name: "Log in / Sign up" });
    expect(combined).toHaveAttribute("href", "/signin");
    expect(visibleFrom(combined)).toEqual({ phone: true, desktop: false });
  });

  it("is a plain link, not the carrier flow's animated button", () => {
    renderNavbar();

    expect(
      screen.getByRole("link", { name: "Log in / Sign up" }).tagName
    ).toBe("A");
    expect(
      screen.getAllByRole("button", { name: "Become a carrier" })
    ).toHaveLength(1);
  });

  it("separates the two doors from `sm` up, and hides them on a phone", () => {
    renderNavbar();

    const login = screen.getByRole("link", { name: "Log in" });
    const signUp = screen.getByRole("link", { name: "Sign up" });

    expect(login).toHaveAttribute("href", "/signin");
    expect(signUp).toHaveAttribute("href", "/signup");
    expect(visibleFrom(login)).toEqual({ phone: false, desktop: true });
    expect(visibleFrom(signUp)).toEqual({ phone: false, desktop: true });
  });

  it("keeps « Become a carrier » for `sm` and up only", () => {
    renderNavbar();

    const carrier = screen.getByRole("button", { name: "Become a carrier" });
    expect(visibleFrom(carrier)).toEqual({ phone: false, desktop: true });
  });

  it("says it in French", () => {
    renderNavbar("fr");

    expect(
      screen.getByRole("link", { name: "Connexion / Inscription" })
    ).toHaveAttribute("href", "/signin");
    expect(screen.getByRole("link", { name: "Connexion" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inscription" })).toHaveAttribute(
      "href",
      "/signup"
    );
  });

  it("lets the combined label wrap to two lines, which is what fits 360px", () => {
    renderNavbar();

    const combined = screen.getByRole("link", { name: "Log in / Sign up" });
    expect(combined.className).toMatch(/whitespace-normal/);
    expect(combined.className).toMatch(/w-\[5\.5rem\]/);
  });
});

describe("LandingNavbar, 2.97.0 floating bar", () => {
  it("keeps the language and theme controls in the bar from `lg`, and in the menu below it", () => {
    renderNavbar();

    const language = screen.getByRole("group", { name: "Language" });
    const holder = language.parentElement as HTMLElement;
    expect(holder.className.split(/\s+/)).toEqual(expect.arrayContaining(["hidden", "lg:flex"]));
    expect(screen.getByRole("button", { name: "Open the menu" })).toBeInTheDocument();
  });
});

describe("LandingNavbar, signed in", () => {
  it("keeps today's « Open app » and offers neither sign-in door", () => {
    auth.isAuthenticated = true;
    renderNavbar();

    const openApp = screen.getByRole("link", { name: "Open app" });
    expect(openApp).toHaveAttribute("href", "/home");
    // Since 2.97.0 the preferences moved into the menu, which left a phone
    // room for the one door that matters.
    expect(visibleFrom(openApp)).toEqual({ phone: true, desktop: true });
    expect(screen.queryByText("Log in / Sign up")).not.toBeInTheDocument();
    expect(screen.queryByText("Log in")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign up")).not.toBeInTheDocument();
    expect(screen.queryByText("Become a carrier")).not.toBeInTheDocument();
  });
});
