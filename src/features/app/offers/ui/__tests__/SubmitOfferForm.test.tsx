import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import type { Job } from "@/features/app/listing/types";

/**
 * The carrier's price box (numeric_input_spec.md §6): it starts from the
 * job's budget written as money is written in the box — « 89,90 », where
 * `String(cents / 100)` gave « 89.9 » — and is read on the digits.
 *
 * The fleet and the mutation are stood in for, and so are the slots: a day is
 * picked in a calendar this test is not about. The vehicle select is the real
 * Radix one, chosen by its first letter the way a keyboard can.
 */

const mutate = vi.fn();
beforeEach(() => mutate.mockClear());

vi.mock("@/features/app/carrier/hooks/useCarrier", () => ({
  useVehicles: () => ({
    isLoading: false,
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
  }),
}));

vi.mock("../../hooks/useCarrierOffers", () => ({
  useSubmitOffer: () => ({ mutate, isPending: false }),
}));

vi.mock("../OfferSlotsField", () => ({
  OfferSlotsField: ({
    onSlotsChange,
  }: {
    onSlotsChange: (slots: { day: string; slot: string }[]) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSlotsChange([{ day: "2030-01-07", slot: "morning" }])}
    >
      pick a slot
    </button>
  ),
}));

import { SubmitOfferForm } from "../SubmitOfferForm";

const job = {
  id: "listing-1",
  budgetCents: 8990,
  offersCount: 0,
  weightKg: 100,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  pickupFrom: "2030-01-07T06:00:00.000Z",
  pickupUntil: "2030-01-08T20:00:00.000Z",
  isFlexible: false,
} as unknown as Job;

function renderForm(locale: "fr" | "en" = "fr") {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
      timeZone="Europe/Paris"
    >
      <SubmitOfferForm job={job} />
    </NextIntlClientProvider>
  );
  return screen.getByLabelText(
    (locale === "fr" ? fr : en).listing.bid.form.price
  ) as HTMLInputElement;
}

describe("SubmitOfferForm — the price box", () => {
  it("starts from the budget written as money: « 89,90 » in French", () => {
    expect(renderForm("fr").value).toBe("89,90");
  });

  it("and « 89.90 » in English", () => {
    expect(renderForm("en").value).toBe("89.90");
  });

  it("reads « 040 » as 40 € and offers 4000 cents", () => {
    const price = renderForm();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "A" });
    fireEvent.click(screen.getByRole("button", { name: "pick a slot" }));

    fireEvent.change(price, { target: { value: "040" } });
    expect(price.value).toBe("40");
    fireEvent.click(screen.getByRole("button", { name: fr.listing.bid.form.submit }));
    // Nothing is sent until the summary is confirmed.
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: fr.listing.bid.form.confirm }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: "vehicle-1", priceCents: 4000 })
    );
  });

  it("offers cents exactly: « 40,05 » is 4005", () => {
    const price = renderForm();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "A" });
    fireEvent.click(screen.getByRole("button", { name: "pick a slot" }));

    fireEvent.change(price, { target: { value: "40,05" } });
    fireEvent.click(screen.getByRole("button", { name: fr.listing.bid.form.submit }));
    // Nothing is sent until the summary is confirmed.
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: fr.listing.bid.form.confirm }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ priceCents: 4005 })
    );
  });

  it("will not send an emptied price", () => {
    const price = renderForm();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "A" });
    fireEvent.click(screen.getByRole("button", { name: "pick a slot" }));

    fireEvent.change(price, { target: { value: "" } });

    expect(
      screen.getByRole("button", { name: fr.listing.bid.form.submit })
    ).toBeDisabled();
  });
});

describe("SubmitOfferForm — a button that says why it is dark (client feedback 2026-11-06)", () => {
  it("picks the only vehicle that fits, so a one-van driver has nothing to choose", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "pick a slot" }));

    expect(
      screen.getByRole("button", { name: fr.listing.bid.form.submit })
    ).toBeEnabled();
  });

  it("names the missing day when only the day is missing", () => {
    renderForm();

    expect(
      screen.getByRole("button", { name: fr.listing.bid.form.submit })
    ).toBeDisabled();
    expect(screen.getByText(fr.listing.bid.form.missingSlots)).toBeInTheDocument();
  });

  it("names the missing price when the box is emptied", () => {
    const price = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "pick a slot" }));
    fireEvent.change(price, { target: { value: "" } });

    expect(screen.getByText(fr.listing.bid.form.missingPrice)).toBeInTheDocument();
  });
});
