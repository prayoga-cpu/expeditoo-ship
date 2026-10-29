import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/** « Ma position » and « Retour au départ » — client_feedback_2026_10_29_spec.md §D2. */

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="area-thumbnail" /> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/components/ui/city-field", () => ({
  CityField: ({ id, value }: { id: string; value: { label: string } | null }) => (
    <input id={id} aria-label={id} readOnly value={value?.label ?? ""} />
  ),
}));

import { RouteSearchBar } from "../RouteSearchBar";
import type { JobFilters } from "../../types";

const t = fr.jobBoard.route;
const base = {
  q: "",
  categoryId: null,
  minBudget: null,
  maxBudget: null,
  maxWeightKg: null,
  from: null,
  to: null,
  via: [],
  radiusKm: null,
} as unknown as JobFilters;

function renderBar(filters: JobFilters, mode: "around" | "route" = "around") {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
      <RouteSearchBar
        mode={mode}
        onModeChange={vi.fn()}
        filters={filters}
        onChange={onChange}
        onShowMap={vi.fn()}
      />
    </NextIntlClientProvider>
  );
  return onChange;
}

beforeEach(() => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void) =>
        ok({ coords: { latitude: 48.856613, longitude: 2.352222 } }),
    },
  });
});

describe("RouteSearchBar", () => {
  it("starts from the device's position, rounded, with a radius", () => {
    const onChange = renderBar(base);
    fireEvent.click(screen.getByRole("button", { name: t.useMyPosition }));
    expect(onChange).toHaveBeenCalledWith({
      from: { label: t.myPosition, lat: 48.8566, lng: 2.3522 },
      radiusKm: expect.any(Number),
    });
  });

  it("makes the arrival the departure for a round trip", () => {
    const paris = { label: "Paris", lat: 48.85, lng: 2.35 };
    const onChange = renderBar({ ...base, from: paris }, "route");
    fireEvent.click(screen.getByRole("button", { name: t.backToStart }));
    expect(onChange).toHaveBeenCalledWith({ to: paris });
  });

  it("shows the area thumbnail only once there is a departure", () => {
    renderBar(base);
    expect(screen.queryByTestId("area-thumbnail")).not.toBeInTheDocument();
  });
});
