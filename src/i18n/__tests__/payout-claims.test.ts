import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
// The request card (client_feedback_2026_10_spec.md §6) needs the app's
// providers; this suite reads the FAQ's words and nothing else.
vi.mock("@/features/app/feedback/ui/FeedbackRequestCard", () => ({
  FeedbackRequestCard: () => null,
}));
import DriverHelpPage from "@/app/(app)/driver/help/page";

/**
 * marketing_footer_pages_spec.md §4 ("Payout claims") and §6: until the payout
 * method is settled, nothing says a payment provider holds a carrier's bank
 * details or pays carriers, promises a payout delay or a guaranteed payment,
 * says a transfer leaves on delivery, or says the client's money waits for the
 * delivery. A delivery credits the driver's balance; the driver asks for it,
 * from MIN_WITHDRAWAL_CENTS, and an operator transfers it by hand
 * (payout_safety_spec.md §0, payment_at_booking_spec.md).
 *
 * The whole catalogue is read rather than a list of namespaces: a list of eight
 * left out the hero figure's label and a testimonial.
 */
const FALSE_CLAIMS = [
  /détenue?s? par (notre|un) prestataire de paiement/i,
  /held by (our|a) payment provider/i,
  /stripe[^.]*(versements?|payouts?)/i,
  /jamais un IBAN complet|never a full IBAN/i,
  /sous 7 j|(in|within) 7 days/i,
  /dans la semaine|same week/i,
  /(payée?s?|versée?s?) chaque semaine|(paid|processed) weekly/i,
  /paiement garanti|guaranteed payment/i,
  /pay[ée]e?s? à la livraison|paid on delivery/i,
  /après chaque livraison|after each delivery/i,
  /versements? programmés?|payouts? scheduled/i,
  /débités seulement une fois|captured only once/i,
];

/**
 * « J+7 », "D+7". Inside the app the same notation counts an offer's delivery
 * days (`listing.bid.slots.leadDays`), so it is looked for only on the public
 * pages and in the hardcoded copy below, where it has only ever been a payout
 * promise.
 */
const DAY_OFFSET = /\b[JD] ?\+ ?\d/;

/** The claims in copy hardcoded in a component, which both lists apply to. */
const claimsIn = (text: string) =>
  [...FALSE_CLAIMS, DAY_OFFSET].filter((claim) => claim.test(text));

const CATALOGUES = [
  ["fr", fr],
  ["en", en],
] as const;

/** Every string in `messages`, or under `path`, with where it lives. */
function stringsUnder(messages: unknown, path?: string): [string, string][] {
  const root = (path ?? "")
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], messages);
  const out: [string, string][] = [];
  const walk = (node: unknown, at: string) => {
    if (typeof node === "string") out.push([at, node]);
    else if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) walk(value, at ? `${at}.${key}` : key);
    }
  };
  walk(root, path ?? "");
  return out;
}

function matching(strings: [string, string][], claims: RegExp[]) {
  return strings.filter(([, text]) => claims.some((claim) => claim.test(text)));
}

describe("payout claims", () => {
  it.each(CATALOGUES)("says nothing untrue about how carriers are paid in %s", (_, messages) => {
    expect(matching(stringsUnder(messages), FALSE_CLAIMS)).toEqual([]);
  });

  it.each(CATALOGUES)("promises no « J+N » on the public pages in %s", (_, messages) => {
    expect(matching(stringsUnder(messages, "marketing"), [DAY_OFFSET])).toEqual([]);
  });

  // The form keeps only the last four characters of the IBAN typed into it, so
  // the account an operator transfers to is the one on the uploaded RIB.
  it.each(CATALOGUES)("sends the banking form to the RIB in %s", (_, messages) => {
    expect(messages.carrier.application.banking.description).toMatch(/\bRIB\b/);
  });
});

describe("payout claims hardcoded outside the catalogue", () => {
  // The landing's hard-coded figures (LandingStats) went with the 2.96.0
  // rebuild, which states no figure at all. What is left outside the catalogue
  // is the driver FAQ below.
  it.each([
    ["en", en, /request a withdrawal/i],
    ["fr", fr, /demandez un retrait/i],
  ] as const)(
    "answers « How do I get paid? » on /driver/help with no schedule (%s)",
    (locale, messages, asksForWithdrawal) => {
      const question = messages.driver.help.faq.paid.question;
      render(
        createElement(NextIntlClientProvider, {
          locale,
          messages,
          children: createElement(DriverHelpPage),
        })
      );
      fireEvent.click(screen.getByRole("button", { name: question }));
      const answer = screen.getByRole("region", { name: question }).textContent ?? "";

      expect(claimsIn(answer)).toEqual([]);
      expect(answer).toMatch(asksForWithdrawal);
    }
  );
});
