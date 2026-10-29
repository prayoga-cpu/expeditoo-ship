import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/** « Mes demandes » as a map — client_feedback_2026_10_29_spec.md §D2. */

const fitBounds = vi.fn();
vi.mock("react-map-gl/maplibre", async () => {
  const React = await import("react");
  const Map = React.forwardRef(function Map(
    { children, onLoad }: { children: React.ReactNode; onLoad?: () => void },
    ref: React.Ref<unknown>
  ) {
    React.useImperativeHandle(ref, () => ({ fitBounds }));
    React.useEffect(() => onLoad?.(), [onLoad]);
    return <div data-testid="map">{children}</div>;
  });
  return {
    default: Map,
    Marker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    NavigationControl: () => null,
    Source: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Layer: () => null,
  };
});
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));

import { RequestsMap } from "../RequestsMap";
import type { Job } from "../../types";

const job = (id: string, over: Partial<Job> = {}) =>
  ({
    id,
    title: `Demande ${id}`,
    status: "open",
    pickupCity: "Paris",
    dropoffCity: "Lyon",
    pickupLat: 48.85,
    pickupLng: 2.35,
    dropoffLat: 45.76,
    dropoffLng: 4.84,
    pickupFrom: "2030-01-10T08:00:00.000Z",
    pickupUntil: "2030-01-10T18:00:00.000Z",
    isFlexible: false,
    budgetCents: 12_000,
    ...over,
  }) as Job;

window.HTMLElement.prototype.scrollIntoView ??= () => {};

const renderMap = (jobs: Job[]) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
      <RequestsMap jobs={jobs} />
    </NextIntlClientProvider>
  );

describe("RequestsMap", () => {
  it("frames every request, then zooms onto the one chosen in the list", () => {
    renderMap([job("a"), job("b", { dropoffLat: 43.3, dropoffLng: 5.37 })]);
    expect(fitBounds).toHaveBeenCalled();
    fitBounds.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /^Demande b/ }));
    expect(fitBounds).toHaveBeenCalledWith(
      [
        [2.35, 43.3],
        [5.37, 48.85],
      ],
      expect.objectContaining({ maxZoom: 13 })
    );
    expect(screen.getByRole("link", { name: /Ouvrir la demande/ })).toHaveAttribute(
      "href",
      "/listing/b"
    );
  });

  it("picks the row when its pin is chosen", () => {
    renderMap([job("a")]);
    fireEvent.click(screen.getByRole("button", { name: /Voir « Demande a »/ }));
    expect(screen.getByRole("button", { name: /^Demande a/, pressed: true })).toBeInTheDocument();
  });

  it("counts the requests with no point to plot", () => {
    renderMap([job("a"), job("c", { pickupLat: null })]);
    expect(screen.getByText(/1 demande sans point sur la carte/)).toBeInTheDocument();
  });
});
