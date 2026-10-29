import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/** « Planificateur de tournée » — client_feedback_2026_10_29_spec.md §N8. */

const m = vi.hoisted(() => ({ plan: vi.fn() }));
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="plan-map" /> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/components/ui/city-field", () => ({
  CityField: ({ id }: { id: string }) => <input aria-label={id} readOnly />,
}));
vi.mock("@/features/app/driver/hooks/useDriverShipments", () => ({
  useDriverShipments: () => ({
    isLoading: false,
    shipments: [
      {
        id: "run-1",
        status: "ASSIGNED",
        pickupLat: 48.85,
        pickupLng: 2.35,
        dropoffLat: 45.76,
        dropoffLng: 4.84,
        listing: { title: "Armoire" },
      },
      {
        id: "run-2",
        status: "IN_TRANSIT",
        pickupLat: 47.3,
        pickupLng: 5.04,
        dropoffLat: 43.3,
        dropoffLng: 5.37,
        listing: { title: "Buffet" },
      },
    ],
  }),
}));
vi.mock("../../api/route-plan.api", () => ({ routePlanApi: { plan: m.plan } }));

import { RoutePlanner } from "../RoutePlanner";

const t = fr.carrier.planner;

function renderPlanner() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        <RoutePlanner />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe("RoutePlanner", () => {
  it("adds a run as its pickup then its delivery, and goods on board as a delivery only", () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: "Armoire" }));
    fireEvent.click(screen.getByRole("button", { name: "Buffet" }));
    const stops = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(stops[0]).toContain("Retrait — Armoire");
    expect(stops[1]).toContain("Livraison — Armoire");
    expect(stops[2]).toContain("Livraison — Buffet");
    expect(stops).toHaveLength(3);
  });

  it("refuses to plan a delivery before its pickup", () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: "Armoire" }));
    fireEvent.click(screen.getByRole("button", { name: /Monter « Livraison — Armoire »/ }));
    expect(screen.getByText(t.outOfOrder)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.plan })).toBeDisabled();
  });

  it("asks for the stops in the driver's order, and shows both times", async () => {
    m.plan.mockResolvedValue({
      withMotorway: { distanceKm: 465.8, durationMinutes: 297, line: [] },
      withoutMotorway: { distanceKm: 497.9, durationMinutes: 617, line: [] },
    });
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: "Armoire" }));
    fireEvent.click(screen.getByRole("button", { name: t.plan }));

    await waitFor(() => expect(screen.getByText("4 h 57")).toBeInTheDocument());
    expect(m.plan.mock.calls[0][0]).toEqual([
      { lat: 48.85, lng: 2.35 },
      { lat: 45.76, lng: 4.84 },
    ]);
    expect(screen.getByText("10 h 17")).toBeInTheDocument();
  });
});
