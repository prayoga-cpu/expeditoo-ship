import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";

import { slotInterval } from "@/lib/availability-window";
import type { OfferSlotInput } from "@/lib/offer-slots";
import { OfferSlotsField } from "../OfferSlotsField";

/**
 * The driver's proposal.
 *
 * What a typecheck cannot see: that clearing the last period on a day removes
 * the day rather than leaving a day nobody can be collected on, and that the
 * whole control speaks French — this is a French product and the form it sits
 * in was hardcoded English until this change.
 */

/**
 * Wide enough that no timezone can push a period of 25-28 August outside it,
 * and `NOW` sits weeks before, so nothing is refused for having elapsed. Both
 * matter: the field asks `offerablePeriods` the same question the service asks,
 * and a fixture that straddled a boundary would make these tests pass or fail
 * on the machine's timezone.
 */
const WINDOW = {
  from: new Date("2026-08-20T00:00:00Z"),
  until: new Date("2026-09-05T00:00:00Z"),
  isFlexible: false,
};

const NOW = new Date("2026-08-01T00:00:00Z");

function renderField(
  slots: OfferSlotInput[],
  locale: "en" | "fr" = "en",
  window = WINDOW
) {
  const onSlotsChange = vi.fn<(next: OfferSlotInput[]) => void>();
  const onDeliveryLeadChange = vi.fn<(days: number) => void>();
  const onError = vi.fn<(error: Error) => void>();

  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : fr}
      onError={onError}
      timeZone="Europe/Paris"
    >
      <OfferSlotsField
        slots={slots}
        onSlotsChange={onSlotsChange}
        deliveryLeadDays={0}
        onDeliveryLeadChange={onDeliveryLeadChange}
        window={window}
        now={NOW}
      />
    </NextIntlClientProvider>
  );

  return { onSlotsChange, onDeliveryLeadChange, onError };
}

const wholeDay = (day: string): OfferSlotInput[] => [
  { day, slot: "morning" },
  { day, slot: "afternoon" },
  { day, slot: "evening" },
];

describe("OfferSlotsField", () => {
  it("asks for a day when nothing is proposed yet", () => {
    const { onError } = renderField([]);

    expect(
      screen.getByText("Add at least one day when you can do this job.")
    ).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });

  it("shows a proposed day with each of its periods pressed", () => {
    renderField(wholeDay("2026-08-25"));

    for (const period of ["Morning", "Afternoon", "Evening"]) {
      expect(screen.getByRole("button", { name: period })).toHaveAttribute(
        "data-state",
        "on"
      );
    }
  });

  it("narrows a day when a period is switched off", () => {
    const { onSlotsChange } = renderField(wholeDay("2026-08-25"));

    fireEvent.click(screen.getByRole("button", { name: "Morning" }));

    expect(onSlotsChange).toHaveBeenCalledWith([
      { day: "2026-08-25", slot: "afternoon" },
      { day: "2026-08-25", slot: "evening" },
    ]);
  });

  // A day nobody can collect on is not a day the driver is offering.
  it("drops the day when its last period is switched off", () => {
    const { onSlotsChange } = renderField([
      { day: "2026-08-25", slot: "evening" },
      { day: "2026-08-27", slot: "morning" },
    ]);

    // Every row renders all three periods, so the query has to name the row.
    const [first] = screen.getAllByRole("listitem");
    fireEvent.click(within(first).getByRole("button", { name: "Evening" }));

    expect(onSlotsChange).toHaveBeenCalledWith([
      { day: "2026-08-27", slot: "morning" },
    ]);
  });

  it("removes a whole day from its remove button", () => {
    const { onSlotsChange } = renderField([
      ...wholeDay("2026-08-25"),
      { day: "2026-08-27", slot: "morning" },
    ]);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove this day" })[0]);

    expect(onSlotsChange).toHaveBeenCalledWith([
      { day: "2026-08-27", slot: "morning" },
    ]);
  });

  it("says why no fifth day is on offer, without locking the calendar shut", () => {
    renderField(
      ["2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"].map((day) => ({
        day,
        slot: "morning" as const,
      }))
    );

    // The trigger stays live so a day can still be swapped for another — the
    // calendar closes the unchosen days instead, which is what stops a fifth
    // without silently deleting a choice already made.
    expect(screen.getByRole("button", { name: "Add a day" })).toBeEnabled();
    expect(
      screen.getByText("4 days maximum. Remove one to propose another.")
    ).toBeInTheDocument();
  });

  // The server refuses an offer WHOLE, so a period it would reject must never
  // be proposable — otherwise one bad period costs the driver the entire bid.
  it("closes a period the job's pickup window cannot take", () => {
    // Built from the same helper the field resolves slots with, so the window
    // is exactly that morning in whatever timezone the suite runs in. Writing
    // the bounds as UTC literals would make this pass only near Greenwich.
    const morning = slotInterval("2026-08-25", "morning", NOW.getTimezoneOffset());

    renderField([{ day: "2026-08-25", slot: "morning" }], "en", {
      from: morning.start,
      until: morning.end,
      isFlexible: false,
    });

    expect(screen.getByRole("button", { name: "Evening" })).toBeDisabled();
  });

  it("reports the delivery lead the driver picks", () => {
    const { onDeliveryLeadChange } = renderField(wholeDay("2026-08-25"));

    fireEvent.click(screen.getByRole("radio", { name: "D+2" }));

    expect(onDeliveryLeadChange).toHaveBeenCalledWith(2);
  });

  it("speaks French, which is the product's own language", () => {
    const { onError } = renderField(wholeDay("2026-08-25"), "fr");

    expect(screen.getByText("Vos créneaux")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Après-midi" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Le jour même" })).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });
});
