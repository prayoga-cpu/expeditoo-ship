import { render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import fr from "../../../../../../messages/fr.json";
import type { DeliverySummaryView } from "../../types";
import { DeliveryCard } from "../DeliveryCard";

/** listing_reference_spec.md §3 — the reference on the tracking list. */

const DELIVERY: DeliverySummaryView = {
  id: "ship_1",
  title: "Armoire normande",
  reference: 100042,
  status: "ASSIGNED",
  pickupAddress: "1 rue de la Gare, Caen",
  dropoffAddress: "2 place du Marché, Rennes",
  priceCents: 25_000,
  counterpartName: "Camille",
  dateLabel: "5 oct. 08:00",
};

const render = (delivery: DeliverySummaryView) =>
  rtlRender(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <DeliveryCard delivery={delivery} />
    </NextIntlClientProvider>
  );

describe("DeliveryCard", () => {
  it("shows the job's reference under its title", () => {
    render(DELIVERY);

    expect(screen.getByText("Réf. 100042")).toBeInTheDocument();
  });

  it("shows no reference line, and no stand-in, when the job is gone", () => {
    const { container } = render({ ...DELIVERY, reference: null });

    expect(container.textContent).not.toMatch(/Réf\./);
    expect(container.textContent).not.toContain("ship_1");
  });

  it("puts no button inside the card's link", () => {
    render(DELIVERY);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
