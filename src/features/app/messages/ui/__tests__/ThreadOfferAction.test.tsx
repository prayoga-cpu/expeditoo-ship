import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import { ThreadOfferAction, ThreadOfferNotice } from "../ThreadOfferAction";
import type { ThreadOfferBlock, ThreadOfferContext } from "../../types";

/**
 * The trigger is self-gating: every branch is decided server-side and handed
 * down as `offerContext`, so this asserts the component adds no judgement of
 * its own — and in particular never renders a disabled button, which invites a
 * support ticket rather than answering one.
 *
 * Covers docs/specs/thread_offer_spec.md §8.1 and §12.
 */
const onError = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// The dialog pulls the carrier's fleet; the trigger's own behaviour is what is
// under test here.
vi.mock("@/features/app/carrier/hooks/useCarrier", () => ({
  useVehicles: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

const job = {
  id: "listing-1",
  title: "Paris → Lyon",
  budgetCents: 20000,
  weightKg: 50,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  pickupFrom: new Date().toISOString(),
  pickupUntil: new Date().toISOString(),
  isFlexible: true,
};

const ctx = (overrides: Partial<ThreadOfferContext> = {}): ThreadOfferContext => ({
  lane: "job",
  canOffer: false,
  blockedBy: null,
  job,
  viewerCanAward: false,
  ...overrides,
});

function wrap(ui: React.ReactNode, locale = "fr", messages: typeof en = fr as typeof en) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={messages} onError={onError}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => onError.mockClear());

describe.each([
  ["fr", fr as typeof en],
  ["en", en],
])("ThreadOfferAction (%s)", (locale, messages) => {
  it("shows the trigger with an accessible name when an offer is allowed", () => {
    wrap(
      <ThreadOfferAction conversationId="c" context={ctx({ canOffer: true })} />,
      locale,
      messages
    );

    const label = (messages as typeof en).messages.offer.button;
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("ThreadOfferAction — silence is a feature", () => {
  it("renders nothing at all when there is no context", () => {
    const { container } = wrap(
      <ThreadOfferAction conversationId="c" context={null} />
    );
    expect(container.innerHTML).toBe("");
  });

  it.each<ThreadOfferBlock>([
    "NOT_A_CARRIER",
    "NOT_APPROVED",
    "OWN_LISTING",
    "LISTING_NOT_OPEN",
    "LISTING_EXPIRED",
  ])("renders nothing, not a disabled button, for %s", (blockedBy) => {
    const { container } = wrap(
      <ThreadOfferAction conversationId="c" context={ctx({ blockedBy })} />
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("ThreadOfferNotice", () => {
  it("explains an absent button when a live offer already stands", () => {
    const { container } = wrap(
      <ThreadOfferNotice context={ctx({ blockedBy: "OFFER_LIVE" })} />
    );

    expect(container.textContent).toContain(fr.messages.offer.alreadyBid);
  });

  it("points a burnt slot at the job it was spent on", () => {
    const { container } = wrap(
      <ThreadOfferNotice context={ctx({ blockedBy: "OFFER_SLOT_BURNT" })} />
    );

    expect(container.textContent).toContain(fr.messages.offer.slotBurnt);
    expect(container.querySelector('a[href="/listing/listing-1"]')).not.toBeNull();
  });

  it("says nothing when an offer is allowed", () => {
    const { container } = wrap(
      <ThreadOfferNotice context={ctx({ canOffer: true })} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("says nothing for the silent blocks", () => {
    const { container } = wrap(
      <ThreadOfferNotice context={ctx({ blockedBy: "NOT_A_CARRIER" })} />
    );
    expect(container.innerHTML).toBe("");
  });
});
