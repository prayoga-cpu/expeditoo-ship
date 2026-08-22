import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";

import VerificationPage from "../verification/page";
import AuctionHousesPage from "../auction-houses/page";
import ContactPage from "../contact/page";
import LegalNoticePage from "../legal-notice/page";
import TermsPage from "../terms/page";
import PrivacyPage from "../privacy/page";
import { contactSubjects } from "@/server/dto/contact.dto";

/**
 * next-intl does not throw on a missing key — it renders the key path and
 * calls `onError`. So a page reaching for `marketing.terms.sections` in a
 * catalogue that lacks it looks like a page with a stray string in it, not a
 * failure. These pages read most of their content through `t.raw`, which is
 * typed `unknown` and invisible to the compiler, so this is the only check
 * that the copy is actually there — in both languages.
 */

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

// The shared navbar carries the language and theme toggles, which read app
// context this test has no reason to stand up. The pages under test are what
// matters; the toggles have their own behaviour elsewhere.
vi.mock("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ locale: "en", setLocale: vi.fn() }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

// The navbar's sign-up button is gated and routes on click.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Third entry is the minimum rendered text length. `/contact` is mostly form
 * controls, which carry no text content of their own, so it is held to a lower
 * bar and covered separately below; the prose pages should be substantial.
 */
const PAGES: [string, ComponentType, number][] = [
  ["verification", VerificationPage, 2000],
  ["auction-houses", AuctionHousesPage, 2000],
  ["contact", ContactPage, 1000],
  ["legal-notice", LegalNoticePage, 2000],
  ["terms", TermsPage, 2000],
  ["privacy", PrivacyPage, 2000],
];

const CATALOGUES: [string, typeof en][] = [
  ["en", en],
  ["fr", fr as unknown as typeof en],
];

/** `/contact` submits through react-query, so the page needs a client. */
function withProviders(
  ui: React.ReactNode,
  locale: string,
  messages: typeof en,
  onError: () => void
) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        onError={onError}
        timeZone="Europe/Paris"
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe.each(PAGES)("marketing page /%s", (name, Page, minLength) => {
  it.each(CATALOGUES)("renders in %s with no missing key", (locale, messages) => {
    const onError = vi.fn();

    const { unmount } = render(
      withProviders(<Page />, locale, messages, onError)
    );

    // A page whose heading rendered is a page whose namespace resolved.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(onError.mock.calls.map((call) => String(call[0]))).toEqual([]);

    unmount();
  });

  it(`has real content on /${name}`, () => {
    const { container, unmount } = render(
      withProviders(<Page />, "en", en, vi.fn())
    );

    // Guards against a page that renders its frame and nothing else, which is
    // how an empty `t.raw` array fails: silently, and looking deliberate. The
    // navbar and footer alone are worth a few hundred characters.
    expect(container.textContent?.length ?? 0).toBeGreaterThan(minLength);
    unmount();
  });
});

describe("/contact", () => {
  it("renders a usable form, not just contact details", () => {
    render(withProviders(<ContactPage />, "en", en, vi.fn()));

    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send message/i })
    ).toBeInTheDocument();
  });

  it("offers every subject the DTO defines and no others", () => {
    render(withProviders(<ContactPage />, "en", en, vi.fn()));

    const options = screen.getAllByRole("option") as HTMLOptionElement[];

    // The form derives its options from `contactSubjects`; a second hardcoded
    // list is exactly the drift this asserts against.
    expect(options.map((option) => option.value)).toEqual([
      ...contactSubjects,
    ]);
  });
});
