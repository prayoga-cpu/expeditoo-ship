import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import { LandingCTA } from "../LandingCTA";
import { LandingNavbar } from "../LandingNavbar";

/**
 * `docs/specs/landing_gated_actions_spec.md` §6 — the page stops telling a
 * signed-in driver to become a carrier.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const auth = { isAuthenticated: false, isLoading: false };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => auth,
}));

vi.mock("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ locale: "en", setLocale: vi.fn(), isLoading: false }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

function renderWithMessages(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  auth.isAuthenticated = false;
  auth.isLoading = false;
});

afterEach(() => vi.clearAllMocks());

describe("navbar", () => {
  it("offers the carrier CTA to a signed-out visitor", () => {
    renderWithMessages(<LandingNavbar />);

    expect(screen.getByText("Become a carrier")).toBeInTheDocument();
    expect(screen.getByText("Log in")).toBeInTheDocument();
  });

  it("drops the carrier CTA once there is a session", () => {
    auth.isAuthenticated = true;
    renderWithMessages(<LandingNavbar />);

    expect(screen.queryByText("Become a carrier")).not.toBeInTheDocument();
    expect(screen.getByText("Open app")).toBeInTheDocument();
  });
});

describe("CTA band", () => {
  it("invites a signed-out visitor to apply, without promising a verification time", () => {
    renderWithMessages(<LandingCTA />);

    expect(screen.getByText("Become a carrier")).toBeInTheDocument();
    expect(screen.getByText(/upload your documents/)).toBeInTheDocument();
    // « Verified in 24 hours » was a promise nobody keeps (client feedback 2026-11-06, U01).
    expect(screen.queryByText(/24 hours/)).not.toBeInTheDocument();
  });

  it("points a signed-in visitor at their profile instead", () => {
    auth.isAuthenticated = true;
    renderWithMessages(<LandingCTA />);

    expect(screen.getByText("Open your profile")).toBeInTheDocument();
    expect(screen.getByText(/already signed in/)).toBeInTheDocument();
    expect(screen.queryByText("Become a carrier")).not.toBeInTheDocument();
  });
});
