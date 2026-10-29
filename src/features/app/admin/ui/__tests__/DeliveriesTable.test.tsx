import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import fr from "../../../../../../messages/fr.json";
import type { PendingDelivery } from "../../types";
import { DeliveriesTable } from "../DeliveriesTable";

/**
 * The admin « Expéditions » table (client_feedback_2026_10_21_spec.md §A5,
 * client_feedback_2026_10_29_spec.md §A4).
 */
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
  requesterName: "Nicolas Denis",
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

  it("leads with the bare number, not route letters or a random id", () => {
    renderTable([run()]);

    expect(screen.getByText("Réf. 100004")).toBeInTheDocument();
    expect(screen.queryByText(/LYO-MAR/)).not.toBeInTheDocument();
    expect(screen.queryByText("#13FFK7WE")).not.toBeInTheDocument();
  });

  it("reads number · departure · arrival · requester, with the initials", () => {
    renderTable([run()]);

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent ?? "");
    const at = (label: string) => headers.findIndex((h) => h.includes(label));
    expect(at(fr.shipments.table.reference)).toBeLessThan(at(fr.shipments.table.departure));
    expect(at(fr.shipments.table.departure)).toBeLessThan(at(fr.shipments.table.arrival));
    expect(at(fr.shipments.table.arrival)).toBeLessThan(at(fr.shipments.table.requester));
    expect(screen.getByText("Lyon")).toBeInTheDocument();
    expect(screen.getByText("Marseille")).toBeInTheDocument();
    expect(screen.getByText("Nicolas Denis")).toBeInTheDocument();
    expect(screen.getByText("ND")).toBeInTheDocument();
  });

  it("speaks the status in the client's words, and has no « Propositions » column", () => {
    renderTable([run()]);

    expect(screen.getByText(fr.deliveries.shipmentStatus.ASSIGNED)).toBeInTheDocument();
    expect(screen.queryByText("Propositions")).not.toBeInTheDocument();
  });
});
