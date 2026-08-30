import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import { ThreadOfferBubble } from "../ThreadOfferBubble";
import type { ThreadOfferView } from "../../types";

/**
 * Every status label is looked up at runtime as `messages.offer.card.status.${s}`
 * — built from a value, so neither TypeScript nor a grep can vouch for it, and
 * next-intl renders the key path instead of throwing when one is missing. Both
 * catalogues are walked here for that reason.
 *
 * Covers docs/specs/thread_offer_spec.md §8.3, §8.4 and §12.
 */
const onError = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const offer = (overrides: Partial<ThreadOfferView> = {}): ThreadOfferView => ({
  id: "to-1",
  priceCents: 18000,
  pickupDay: "2026-09-12",
  pickupSlot: "morning",
  deliveryLeadDays: 0,
  status: "pending",
  note: null,
  senderId: "user-them",
  offer: { id: "offer-1", listingId: "listing-1", status: "pending" },
  vehicle: null,
  ...overrides,
});

function renderBubble(
  props: Partial<React.ComponentProps<typeof ThreadOfferBubble>> = {},
  locale = "fr",
  messages: typeof en = fr as typeof en
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        onError={onError}
      >
        <ThreadOfferBubble
          conversationId="conv-1"
          offer={offer()}
          isOwn={false}
          timestamp="14:02"
          viewerCanAward
          {...props}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => onError.mockClear());

describe.each([
  ["fr", fr as typeof en],
  ["en", en],
])("ThreadOfferBubble (%s)", (locale, messages) => {
  it("renders the price and no missing-key path", () => {
    const { container } = renderBubble({}, locale, messages);

    expect(container.textContent).not.toContain("messages.offer");
    expect(onError).not.toHaveBeenCalled();
  });

  it.each(["pending", "accepted", "rejected", "expired"] as const)(
    "gives the %s status its own wording",
    (status) => {
      const { container } = renderBubble(
        {
          offer: offer({
            offer: { id: "o", listingId: "listing-1", status },
          }),
        },
        locale,
        messages
      );

      expect(container.textContent).not.toContain("card.status");
      expect(onError).not.toHaveBeenCalled();
    }
  );

  it("strikes through the price of a withdrawn standalone offer", () => {
    const { container } = renderBubble(
      { offer: offer({ offer: null, status: "withdrawn" }) },
      locale,
      messages
    );

    expect(container.querySelector(".line-through")).not.toBeNull();
  });
});

describe("ThreadOfferBubble — who can do what", () => {
  it("offers Accept and Decline to the recipient who awards", () => {
    renderBubble({ isOwn: false, viewerCanAward: true });

    expect(
      screen.getByRole("button", { name: fr.messages.offer.card.accept })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: fr.messages.offer.card.decline })
    ).toBeTruthy();
  });

  it("tells a recipient who cannot award that an operator decides", () => {
    const { container } = renderBubble({ isOwn: false, viewerCanAward: false });

    expect(container.textContent).toContain(
      fr.messages.offer.card.operatorDecides
    );
    expect(screen.queryByRole("button", { name: fr.messages.offer.card.accept }))
      .toBeNull();
  });

  it("offers the sender Withdraw instead of Accept", () => {
    renderBubble({ isOwn: true });

    expect(
      screen.getByRole("button", { name: fr.messages.offer.card.withdraw })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: fr.messages.offer.card.accept }))
      .toBeNull();
  });

  it("offers nothing once the offer is settled", () => {
    renderBubble({
      offer: offer({ offer: { id: "o", listingId: "l", status: "accepted" } }),
    });

    expect(screen.queryByRole("button", { name: fr.messages.offer.card.accept }))
      .toBeNull();
    expect(
      screen.queryByRole("button", { name: fr.messages.offer.card.decline })
    ).toBeNull();
  });

  it("says plainly that an accepted standalone offer takes no payment", () => {
    const { container } = renderBubble({
      offer: offer({ offer: null, status: "accepted" }),
    });

    expect(container.textContent).toContain(fr.messages.offer.card.noPayment);
  });

  it("never renders a slot picker — a chat offer carries exactly one slot", () => {
    const { container } = renderBubble();

    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(container.querySelectorAll('[role="radiogroup"]').length).toBe(0);
  });
});
