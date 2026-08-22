import { render } from "@testing-library/react";
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

afterEach(() => vi.clearAllMocks());

describe.each([
  ["en", en],
  ["fr", fr],
])("landing page in %s", (locale, messages) => {
  it("renders every key it reaches for", () => {
    const onError = vi.fn();

    const { container } = render(
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        onError={onError}
      >
        <LandingPage />
      </NextIntlClientProvider>
    );

    expect(onError).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("marketing.");
  });
});
