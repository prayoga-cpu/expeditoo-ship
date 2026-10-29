import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import fr from "../../../../../../messages/fr.json";
import { BookingSummary } from "../BookingSummary";
import type { Job, Offer } from "../../types";

/** client_feedback_2026_10_29_spec.md §N1 — what is booked, before the card. */
const offer = {
  id: "o1",
  deliveryLeadDays: 1,
  estimatedPickup: "2026-11-05T07:00:00.000Z",
  estimatedDelivery: "2026-11-06T21:00:00.000Z",
  slots: [
    { id: "s1", day: "2026-11-05", slot: "morning", startsAt: "", endsAt: "", deliveryAt: "" },
    { id: "s2", day: "2026-11-07", slot: "afternoon", startsAt: "", endsAt: "", deliveryAt: "" },
  ],
} as unknown as Offer;

const renderIt = (job: Partial<Job>, slotId?: string) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
      <BookingSummary job={job as Job} offer={offer} slotId={slotId} />
    </NextIntlClientProvider>
  );

describe("BookingSummary", () => {
  it("names the slot being booked and the delivery it promises", () => {
    renderIt({}, "s2");
    expect(screen.getByText(/sam\. 7 nov\./)).toBeInTheDocument();
    expect(screen.getByText(/dim\. 8 nov\./)).toBeInTheDocument();
  });

  it("shows the requester's own delivery days and times", () => {
    renderIt({ dropoffDays: [1, 2], dropoffPeriods: ["morning"] });
    expect(screen.getByText(/Vos disponibilités à la livraison/)).toBeInTheDocument();
  });

  it("says when no delivery limit was given", () => {
    renderIt({});
    expect(screen.getByText(fr.booking.noAvailability)).toBeInTheDocument();
  });
});
