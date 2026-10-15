import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";
import { ApiError } from "@/lib/fetcher";

/**
 * Every « Mes trajets » tab says when its list failed and offers « Réessayer »
 * (client_feedback_2026_10_spec.md §5, CLAUDE.md gotcha 9). « Prévus » used to
 * read every failure as "no carrier profile", and « Terminés » fell through to
 * its empty state; both keep their old behaviour where it was right.
 */

const state = vi.hoisted(() => ({
  routes: {} as Record<string, unknown>,
  completed: {} as Record<string, unknown>,
}));

vi.mock("../../hooks/useCarrierTrips", () => ({
  useCarrierRoutes: () => state.routes,
  useSaveCarrierRoute: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCarrierRoute: () => ({ mutate: vi.fn() }),
  useToggleCarrierRoute: () => ({ mutate: vi.fn() }),
  useCompletedTrips: () => state.completed,
}));
vi.mock("../../hooks/useCarrier", () => ({ useVehicles: () => ({ data: [] }) }));
vi.mock("../TripRouteFormDialog", () => ({ TripRouteFormDialog: () => null }));
vi.mock("@/components/ui/page-loader", () => ({
  PageLoader: () => <div data-testid="loader" />,
}));

import { PlannedTripsPanel } from "../PlannedTripsPanel";
import { CompletedTripsPanel } from "../CompletedTripsPanel";

const renderFr = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      {ui}
    </NextIntlClientProvider>
  );

describe("« Prévus » on failure", () => {
  const refetch = vi.fn();

  beforeEach(() => {
    refetch.mockClear();
  });

  it("still explains a missing carrier profile, with nothing to retry", () => {
    state.routes = {
      data: undefined,
      isLoading: false,
      error: new ApiError("CARRIER_NOT_FOUND", "No carrier", 404),
      refetch,
    };
    renderFr(<PlannedTripsPanel />);

    expect(
      screen.getByText("Les trajets sont réservés aux transporteurs validés")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Réessayer" })).not.toBeInTheDocument();
  });

  it("calls any other failure a failure, and retries", () => {
    state.routes = {
      data: undefined,
      isLoading: false,
      error: new ApiError("INTERNAL_ERROR", "boom", 500),
      refetch,
    };
    renderFr(<PlannedTripsPanel />);

    expect(screen.getByText("Impossible de charger cette liste")).toBeInTheDocument();
    expect(
      screen.queryByText("Les trajets sont réservés aux transporteurs validés")
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("« Terminés » on failure", () => {
  it("says the list failed instead of claiming nothing was carried out", () => {
    const refetch = vi.fn();
    state.completed = {
      trips: [],
      summary: null,
      commissionRetainsAll: false,
      isLoading: false,
      isError: true,
      error: new ApiError("INTERNAL_ERROR", "boom", 500),
      refetch,
    };
    renderFr(<CompletedTripsPanel />);

    expect(screen.getByText("Impossible de charger cette liste")).toBeInTheDocument();
    expect(screen.queryByText("Aucun transport effectué")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps its own empty state when the list is simply empty", () => {
    state.completed = {
      trips: [],
      summary: null,
      commissionRetainsAll: false,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    renderFr(<CompletedTripsPanel />);

    expect(screen.getByText("Aucun transport effectué")).toBeInTheDocument();
  });
});
