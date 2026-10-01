import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import { ThreadOfferBubble } from "../ThreadOfferBubble";
import { messagesApi } from "../../api";
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

// Stood in for: the real dialog mounts Stripe. What is pinned here is only
// which offer it is opened for, and that it is opened at all.
vi.mock("@/features/app/offers/ui/AcceptPaymentDialog", () => ({
  AcceptPaymentDialog: ({ open, offerId }: { open: boolean; offerId: string }) =>
    open ? <div data-testid="pay-dialog" data-offer={offerId} /> : null,
}));

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

// docs/specs/pay_at_accept_spec.md §2: on the job lane accepting awards a real
// bid and may take a payment, so it goes through the same dialog as the job
// page; a standalone offer moves no money and needs no step.
describe("ThreadOfferBubble — accepting", () => {
  it("opens the payment dialog for the bid behind a job-lane offer", () => {
    const accept = vi.spyOn(messagesApi, "acceptOffer");
    renderBubble();

    fireEvent.click(screen.getByRole("button", { name: fr.messages.offer.card.accept }));

    expect(screen.getByTestId("pay-dialog").getAttribute("data-offer")).toBe("offer-1");
    expect(accept).not.toHaveBeenCalled();
    accept.mockRestore();
  });

  it("accepts a standalone offer at once, with no payment step", async () => {
    const accept = vi
      .spyOn(messagesApi, "acceptOffer")
      .mockResolvedValue({ threadOffer: offer(), shipmentId: null } as never);
    renderBubble({ offer: offer({ offer: null }) });

    fireEvent.click(screen.getByRole("button", { name: fr.messages.offer.card.accept }));

    expect(screen.queryByTestId("pay-dialog")).toBeNull();
    await waitFor(() => expect(accept).toHaveBeenCalledWith("to-1", undefined));
    accept.mockRestore();
  });
});

// The bid stays pending when the recipient declines in the chat, so the card
// used to go on showing « En attente » with both buttons, and Accept opened a
// payment dialog for an offer the thread would then refuse.
describe("ThreadOfferBubble — after the recipient declined here", () => {
  const declined = () => offer({ status: "declined" });

  it("shows the recipient their answer and asks nothing more", () => {
    const { container } = renderBubble({ offer: declined() });

    expect(container.textContent).toContain(fr.messages.offer.card.status.declined);
    expect(screen.queryByRole("button", { name: fr.messages.offer.card.accept }))
      .toBeNull();
    expect(screen.queryByRole("button", { name: fr.messages.offer.card.decline }))
      .toBeNull();
  });

  it("leaves the sender's card as it was — their bid is still live", () => {
    const { container } = renderBubble({ offer: declined(), isOwn: true });

    expect(container.textContent).toContain(fr.messages.offer.card.status.pending);
    expect(
      screen.getByRole("button", { name: fr.messages.offer.card.withdraw })
    ).toBeTruthy();
  });

  it("still follows the bid once somebody has decided it", () => {
    const { container } = renderBubble({
      offer: offer({
        status: "declined",
        offer: { id: "offer-1", listingId: "listing-1", status: "accepted" },
      }),
    });

    expect(container.textContent).toContain(fr.messages.offer.card.status.accepted);
  });
});
