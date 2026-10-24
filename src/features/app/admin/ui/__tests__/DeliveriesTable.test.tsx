import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import fr from "../../../../../../messages/fr.json";
import type { PendingDelivery } from "../../types";
import { DeliveriesTable } from "../DeliveriesTable";

/** The admin « Expéditions » table (client_feedback_2026_10_21_spec.md §A4–A5). */
const run = (over: Partial<PendingDelivery> = {}): PendingDelivery => ({
  id: "13ffk7we-0000",
  title: "BETA · Bureau plat en acajou",
  reference: 100004,
  origin: "Lyon",
  destination: "Marseille",
  status: "ASSIGNED",
  price: 21_000,
  createdDate: "2026-10-20T10:00:00.000Z",
  driverName: "Jean Transport",
  ...over,
});

const renderTable = (rows: PendingDelivery[]) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
      <DeliveriesTable deliveries={rows} />
    </NextIntlClientProvider>
  );

describe("DeliveriesTable", () => {
  it("names the driver, in a column of its own", () => {
    renderTable([run()]);

    expect(screen.getByRole("columnheader", { name: /Chauffeur/ })).toBeInTheDocument();
    expect(screen.getByText("Jean Transport")).toBeInTheDocument();
  });

  it("says so when nobody is driving yet", () => {
    renderTable([run({ driverName: null })]);

    expect(screen.getByText(fr.shipments.table.noDriver)).toBeInTheDocument();
  });

  it("leads with the job's reference, route letters first, not a random id", () => {
    renderTable([run()]);

    expect(screen.getByText("Réf. LYO-MAR-100004")).toBeInTheDocument();
    expect(screen.queryByText("#13FFK7WE")).not.toBeInTheDocument();
  });

  it("speaks the status in the client's words, and has no « Propositions » column", () => {
    renderTable([run()]);

    expect(screen.getByText(fr.deliveries.shipmentStatus.ASSIGNED)).toBeInTheDocument();
    expect(screen.queryByText("Propositions")).not.toBeInTheDocument();
  });
});
