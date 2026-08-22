import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import { LANDING_INTENTS } from "@/lib/landing-intent";
import { GatedButtonContent } from "../LandingGatedButton";
import type { GatedPhase } from "../../hooks/useGatedAction";

/**
 * The phase labels are looked up as `marketing.actions.${intent}.${phase}` —
 * built at runtime, so neither TypeScript nor a grep can vouch for them, and
 * next-intl renders the key path instead of throwing when one is missing.
 *
 * The landing-page render test cannot cover these: on that page every gated
 * element starts idle, so the validating and success keys are never resolved.
 * This walks every intent against every phase in both catalogues instead.
 */

const PHASES: GatedPhase[] = ["idle", "validating", "success", "redirecting"];

describe.each([
  ["en", en],
  ["fr", fr],
])("gated action labels in %s", (locale, messages) => {
  it.each(LANDING_INTENTS)("resolves every phase label for %s", (intent) => {
    const onError = vi.fn();

    for (const phase of PHASES) {
      const { container, unmount } = render(
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          onError={onError}
        >
          <GatedButtonContent phase={phase} intent={intent} idleLabel="Bid" />
        </NextIntlClientProvider>
      );

      expect(container.textContent).not.toContain("marketing.actions");
      expect(container.textContent?.trim()).not.toBe("");
      unmount();
    }

    expect(onError).not.toHaveBeenCalled();
  });
});
