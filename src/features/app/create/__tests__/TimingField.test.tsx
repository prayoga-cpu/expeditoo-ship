import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import type { PublicationIssues } from "../publication";
import {
  ISO_WEEKDAYS,
  TIME_SLOTS,
  forInput,
  type EndpointTiming,
  type TimingState,
} from "../timing";
import { TimingField } from "../ui/TimingField";

/**
 * The « Quand » step as the client asked for it (request_availability_spec.md
 * §5): seven ticked weekdays under each pair of dates, several times of day at
 * once, and the publication notices (publication_timing_spec.md §3.3).
 * 2030-01-02 is a Wednesday.
 */

const NONE: PublicationIssues = { pickup: null, schedule: null, biddingClosesAt: null };

const endpoint = (over: Partial<EndpointTiming> = {}): EndpointTiming => ({
  date: "2030-01-02",
  dateUntil: "2030-01-12",
  slot: "morning",
  hour: "09:00",
  periods: [...TIME_SLOTS],
  days: [...ISO_WEEKDAYS],
  ...over,
});

const flexible = (pickup: Partial<EndpointTiming> = {}): TimingState => ({
  mode: "flexible",
  pickup: endpoint(pickup),
  dropoff: endpoint({ date: "2030-01-13", dateUntil: "2030-01-20" }),
});

function Harness({
  initial,
  publication = NONE,
  pickupClampedFrom = null,
  locale = "fr",
  onError,
}: {
  initial: TimingState;
  publication?: PublicationIssues;
  pickupClampedFrom?: string | null;
  locale?: "fr" | "en";
  onError: (error: Error) => void;
}) {
  const [timing, setTiming] = useState(initial);
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : fr}
      timeZone="Europe/Paris"
      onError={onError}
    >
      <TimingField
        timing={timing}
        onChange={setTiming}
        publication={publication}
        pickupClampedFrom={pickupClampedFrom}
      />
    </NextIntlClientProvider>
  );
}

function renderField(props: Partial<Parameters<typeof Harness>[0]> = {}) {
  const onError = vi.fn<(error: Error) => void>();
  render(<Harness initial={flexible()} onError={onError} {...props} />);
  return { onError };
}

const dayGroups = () => screen.getAllByRole("group", { name: "Jours possibles" });
const pickupDays = () => within(dayGroups()[0]);
const pressed = (name: string, index = 0) =>
  screen.getAllByRole("button", { name })[index].getAttribute("aria-pressed") ===
  "true";

describe("TimingField — weekdays", () => {
  it("ticks all seven days under each pair of dates", () => {
    const { onError } = renderField();

    expect(dayGroups()).toHaveLength(2);
    for (const group of dayGroups()) {
      const boxes = within(group).getAllByRole("checkbox");
      expect(boxes.map((box) => box.getAttribute("aria-checked"))).toEqual(
        Array(7).fill("true")
      );
    }
    expect(onError).not.toHaveBeenCalled();
  });

  it("names them Monday first", () => {
    renderField();

    expect(
      pickupDays()
        .getAllByRole("checkbox")
        .map((box) => box.id)
    ).toEqual(ISO_WEEKDAYS.map((day) => `pickup-day-${day}`));
    expect(pickupDays().getByRole("checkbox", { name: "Lun" })).toBeInTheDocument();
    expect(pickupDays().getByRole("checkbox", { name: "Dim" })).toBeInTheDocument();
  });

  it("unticks a day", () => {
    renderField();
    const friday = pickupDays().getByRole("checkbox", { name: "Ven" });

    fireEvent.click(friday);

    expect(friday).toHaveAttribute("aria-checked", "false");
  });

  it("greys out the days that do not fall between the dates", () => {
    // Wednesday 2 → Thursday 3.
    renderField({ initial: flexible({ dateUntil: "2030-01-03" }) });

    expect(pickupDays().getByRole("checkbox", { name: "Mer" })).toBeEnabled();
    expect(pickupDays().getByRole("checkbox", { name: "Jeu" })).toBeEnabled();
    expect(pickupDays().getByRole("checkbox", { name: "Lun" })).toBeDisabled();
    // Still ticked: widening the range brings it back.
    expect(pickupDays().getByRole("checkbox", { name: "Lun" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByText(fr.create.when.daysOutOfRange)).toBeInTheDocument();
  });

  it("is not shown for an exact request", () => {
    renderField({ initial: { ...flexible(), mode: "exact" } });

    expect(screen.queryByRole("group", { name: "Jours possibles" })).toBeNull();
  });
});

describe("TimingField — times of day", () => {
  it("starts on « N'importe quand »", () => {
    renderField();

    expect(pressed("N'importe quand")).toBe(true);
    expect(pressed("Matin")).toBe(false);
  });

  it("takes several at once", () => {
    renderField();

    fireEvent.click(screen.getAllByRole("button", { name: "Matin" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Après-midi" })[0]);

    expect(pressed("Matin")).toBe(true);
    expect(pressed("Après-midi")).toBe(true);
    expect(pressed("Soir")).toBe(false);
    expect(pressed("N'importe quand")).toBe(false);
  });

  it("lands back on « N'importe quand » once all three are on", () => {
    renderField({ initial: flexible({ periods: ["morning", "afternoon"] }) });

    fireEvent.click(screen.getAllByRole("button", { name: "Soir" })[0]);

    expect(pressed("N'importe quand")).toBe(true);
  });

  it("unpresses a period", () => {
    renderField({ initial: flexible({ periods: ["morning", "evening"] }) });

    fireEvent.click(screen.getAllByRole("button", { name: "Matin" })[0]);

    expect(pressed("Matin")).toBe(false);
    expect(pressed("Soir")).toBe(true);
  });

  it("falls back to « N'importe quand » when the last period is unpressed", () => {
    renderField({ initial: flexible({ periods: ["evening"] }) });

    fireEvent.click(screen.getAllByRole("button", { name: "Soir" })[0]);

    expect(pressed("N'importe quand")).toBe(true);
  });

  it("widens back to all three from « N'importe quand »", () => {
    renderField({ initial: flexible({ periods: ["morning"] }) });

    fireEvent.click(screen.getAllByRole("button", { name: "N'importe quand" })[0]);

    expect(pressed("N'importe quand")).toBe(true);
    expect(pressed("Matin")).toBe(false);
  });

  it("keeps each end's choice to itself", () => {
    renderField();

    fireEvent.click(screen.getAllByRole("button", { name: "Matin" })[0]);

    // Delivery is untouched.
    expect(pressed("N'importe quand", 1)).toBe(true);
  });
});

describe("TimingField — publication", () => {
  it("says a too-soon pickup in words, as a field error", () => {
    renderField({
      publication: {
        ...NONE,
        pickup: { kind: "tooSoon", earliest: new Date("2030-01-02T13:30:00Z") },
      },
    });

    const message = screen.getByText(/trop proche de la publication/);
    // Its own marker: it blocks « Publier », not « Suivant », so it must not
    // take the scroll from a schema error.
    expect(message.closest("[data-publication-error]")).not.toBeNull();
    expect(message.closest("[data-field-error]")).toBeNull();
    expect(message.textContent).toContain("2 janv.");
  });

  it("says a passed pickup", () => {
    renderField({ publication: { ...NONE, pickup: { kind: "inPast" } } });

    expect(screen.getByText(fr.create.publication.pickupInPast)).toBeInTheDocument();
  });

  it("warns, without blocking, when bidding would close soon", () => {
    renderField({
      publication: { ...NONE, biddingClosesAt: new Date("2030-01-02T13:17:00Z") },
    });

    const warning = screen.getByText(/pourront faire une offre jusqu'au/);
    expect(warning.closest("[data-field-error]")).toBeNull();
  });

  it("names the start a passed slot was moved to", () => {
    // The form's own local string for 06:00 in Paris, whatever zone runs this.
    renderField({ pickupClampedFrom: forInput(Date.UTC(2030, 0, 3, 5, 0)) });

    expect(screen.getByText(/au plus tôt le 3 janv\., 06:00/)).toBeInTheDocument();
  });

  it("resolves every label in English", () => {
    const { onError } = renderField({
      locale: "en",
      publication: { ...NONE, pickup: { kind: "inPast" } },
      pickupClampedFrom: forInput(Date.UTC(2030, 0, 3, 5, 0)),
    });

    expect(screen.getAllByRole("group", { name: "Possible days" })).toHaveLength(2);
    expect(onError).not.toHaveBeenCalled();
  });
});
