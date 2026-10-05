import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";

/**
 * payout_safety_spec.md §5 — `/profile` no longer tells everyone to connect a
 * Stripe account to be paid "for items you sell or deliveries you make".
 *
 * The profile hook is the real one, with what it talks to mocked, so the case
 * also proves the page stopped reading the Stripe status that only the card
 * used. The assertions use literal text rather than message keys: the card's
 * keys are deleted from the catalogues by this release.
 */

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      name: "Jean Dupont",
      email: "jean@example.com",
      image: null,
      isVerified: false,
    },
    session: null,
    isLoading: false,
  }),
}));
vi.mock("@/features/auth/hooks/useAuthActions", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
}));
const nav = vi.hoisted(() => ({
  pathname: "/profile",
  roles: ["shipper", "carrier"] as string[],
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => nav.pathname,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { updateUser: vi.fn() } }));
vi.mock("@/features/app/admin/api/users.api", () => ({
  stopImpersonating: vi.fn(),
}));
vi.mock("../../hooks/useUserRoles", () => ({
  useUserRoles: () => ({ data: nav.roles, isLoading: false }),
}));
vi.mock("@/features/app/feedback/ui", () => ({ FeedbackDialog: () => null }));
vi.mock("@/components/ui/page-loader", () => ({
  PageLoader: () => <div data-testid="loader" />,
}));
vi.mock("@/components/ui/lottie-loader", () => ({ LottieLoader: () => null }));

import { Profile } from "../Profile";

/** Every read the profile makes, answered; the URLs are what is asserted. */
const fetchSpy = vi.fn(async (url: string) => {
  const data = url.includes("/stats")
    ? { average: 4.5, total: 2, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 } }
    : url.includes("/provider")
      ? { isOAuth: false, provider: null }
      : null;
  return new Response(JSON.stringify({ success: true, data }));
});

beforeEach(() => {
  nav.pathname = "/profile";
  nav.roles = ["shipper", "carrier"];
  fetchSpy.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
  // The avatar dialog and the feedback tooltip are Radix primitives.
  window.HTMLElement.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.setPointerCapture ??= () => {};
  window.HTMLElement.prototype.releasePointerCapture ??= () => {};
  window.HTMLElement.prototype.scrollIntoView ??= () => {};
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderProfile() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Europe/Paris">
        <Profile />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe("Profile", () => {
  it("shows no Stripe payout card", async () => {
    renderProfile();

    expect(
      await screen.findByRole("heading", { name: /Jean Dupont/ })
    ).toBeInTheDocument();
    // What the card said, to drivers and non-drivers alike.
    expect(screen.queryByText(/stripe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/items you sell/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /payout/i })
    ).not.toBeInTheDocument();
  });

  it("no longer reads the Stripe status the card was built from", async () => {
    renderProfile();
    await screen.findByRole("heading", { name: /Jean Dupont/ });

    const urls = fetchSpy.mock.calls.map(([url]) => url);
    expect(urls.some((url) => url.includes("stripe-status"))).toBe(false);
    // The page's other reads still happen, so the absence above is not just a
    // harness that never fetched anything.
    expect(urls.some((url) => url.includes("/stats"))).toBe(true);
  });
});

describe("Profile — the driver shell's quick links", () => {
  const earnings = () =>
    screen.queryByRole("link", { name: en.profile.quickLinks.earnings });

  it("sends a carrier's earnings link to « Mes gains », which exists", async () => {
    // It pointed at `/earnings`, a route that never existed. An approved
    // carrier is enrolled as their own driver (`enrolAsOwnDriver`), and the
    // driver shell lets in nobody without `driver`: this is the set it shows.
    nav.pathname = "/driver/profile";
    nav.roles = ["shipper", "carrier", "driver"];
    renderProfile();

    expect(await screen.findByRole("link", { name: en.profile.quickLinks.earnings })).toHaveAttribute(
      "href",
      "/carrier/withdrawals"
    );
  });

  it("shows a driver no pay at all", async () => {
    nav.pathname = "/driver/profile";
    nav.roles = ["driver"];
    renderProfile();

    await screen.findByRole("link", { name: en.profile.quickLinks.myReviews });
    expect(earnings()).toBeNull();
  });
});
