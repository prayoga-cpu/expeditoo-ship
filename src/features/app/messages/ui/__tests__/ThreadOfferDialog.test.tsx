import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import type { ThreadOfferContext } from "../../types";

/**
 * The chat offer's price box (numeric_input_spec.md §6). It is filled when the
 * dialog opens rather than when it mounts, so it is checked apart from
 * `SubmitOfferForm`'s: the budget written as money is written in the box,
 * « 89,90 » where `String(cents / 100)` gave « 89.9 ».
 *
 * Rendered already open, through its controlled `open` prop: a click on a
 * Radix trigger never reaches the portal in jsdom.
 */

vi.mock("@/features/app/carrier/hooks/useCarrier", () => ({
  useVehicles: () => ({
    data: [
      {
        id: "vehicle-1",
        plateNumber: "AB-123-CD",
        make: "Renault",
        model: "Master",
        type: "van",
        isActive: true,
        maxWeightKg: 1200,
        maxLengthCm: 400,
        maxWidthCm: 180,
        maxHeightCm: 190,
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../hooks/useThreadOffer", () => ({
  useThreadOffer: () => ({ submit: { mutate: vi.fn(), isPending: false } }),
}));

import { ThreadOfferDialog } from "../ThreadOfferDialog";

const job = {
  id: "listing-1",
  title: "Paris → Lyon",
  budgetCents: 8990,
  weightKg: 50,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  pickupFrom: "2030-01-07T06:00:00.000Z",
  pickupUntil: "2030-01-08T20:00:00.000Z",
  isFlexible: true,
};

const context = (over: Partial<ThreadOfferContext> = {}): ThreadOfferContext => ({
  lane: "job",
  canOffer: true,
  blockedBy: null,
  job,
  viewerCanAward: false,
  ...over,
});

function openDialog(ctx: ThreadOfferContext, locale: "fr" | "en" = "fr") {
  const messages = locale === "fr" ? fr : en;
  render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Paris">
      <ThreadOfferDialog
        conversationId="conversation-1"
        context={ctx}
        open
        onOpenChange={vi.fn()}
      />
    </NextIntlClientProvider>
  );
  return screen.getByLabelText(messages.listing.bid.form.price) as HTMLInputElement;
}

describe("ThreadOfferDialog — the price box", () => {
  it("opens on the budget written as money: « 89,90 » in French", () => {
    expect(openDialog(context()).value).toBe("89,90");
  });

  it("and « 89.90 » in English", () => {
    expect(openDialog(context(), "en").value).toBe("89.90");
  });

  it("opens blank with no job to price, and reads « 040 » as « 40 »", () => {
    const price = openDialog(context({ lane: "standalone", job: null }));
    expect(price.value).toBe("");

    fireEvent.change(price, { target: { value: "040" } });

    expect(price.value).toBe("40");
  });
});
