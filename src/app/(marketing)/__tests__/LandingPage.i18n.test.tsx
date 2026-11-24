import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";
import LandingPage from "../page";

/**
 * The landing page reaches for several keys by template — `jobs.${key}`,
 * `${intent}.validating`, `${intent}.success` — which neither TypeScript nor a
 * grep can vouch for. next-intl does not throw on a missing key: it renders the
 * key path and calls `onError`, so a typo would ship as
 * `marketing.actions.carrier.success` sitting on a button. Asserting `onError`
 * is never called is what catches that, and running it over both catalogues is
 * what keeps them honest with each other.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));

vi.mock("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ locale: "en", setLocale: vi.fn(), isLoading: false }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

/**
 * « Demandes récentes » builds its card text by template too
 * (`kind.${jobKind}`, a range or a single day, a weight or a surface), so the
 * read answers one card of each kind — and, in a second pass, nothing, which
 * is the empty state's keys.
 */
const recent = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock("@/features/marketing/api/recent-requests.api", () => ({
  recentRequestsApi: { list: async () => ({ items: recent.items }) },
}));

const CARDS = [
  {
    id: "job-1",
    reference: 100001,
    title: "Canapé 3 places",
    jobKind: "items",
    pickupCity: "Paris",
    pickupCountry: "FR",
    dropoffCity: "Bruxelles",
    dropoffCountry: "BE",
    pickupFrom: "2026-11-26T08:00:00.000Z",
    pickupUntil: "2026-11-28T18:00:00.000Z",
    isFlexible: true,
    weightKg: 45,
    movingSurfaceM2: null,
    movingVolumeM3: null,
  },
  {
    id: "job-2",
    reference: 100002,
    title: "Déménagement T2",
    jobKind: "moving",
    pickupCity: "Lyon",
    pickupCountry: "FR",
    dropoffCity: "Nice",
    dropoffCountry: "FR",
    pickupFrom: "2026-12-02T08:00:00.000Z",
    pickupUntil: "2026-12-02T10:00:00.000Z",
    isFlexible: false,
    weightKg: 900,
    movingSurfaceM2: 40,
    movingVolumeM3: null,
  },
];

afterEach(() => vi.clearAllMocks());

function renderPage(locale: string, messages: typeof en, onError: () => void) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        onError={onError}
        timeZone="Europe/Paris"
      >
        <LandingPage />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe.each([
  ["en", en],
  ["fr", fr],
])("landing page in %s", (locale, messages) => {
  it("renders every key it reaches for", async () => {
    recent.items = CARDS;
    const onError = vi.fn();

    const { container } = renderPage(locale, messages as typeof en, onError);
    await screen.findByText("Déménagement T2");

    expect(onError).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("marketing.");
  });

  it("renders the empty state's keys", async () => {
    recent.items = [];
    const onError = vi.fn();

    const { container } = renderPage(locale, messages as typeof en, onError);
    // The empty state's own heading: « Aucune demande ouverte… » / "No open requests…".
    await screen.findByRole("heading", { level: 3, name: /ouverte|open requests/i });

    expect(onError).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("marketing.");
  });
});
