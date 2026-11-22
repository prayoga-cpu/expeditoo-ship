import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/**
 * The board's search card (board_route_search_spec.md §12; client feedback
 * 2026-11-19, #3), with « Ma position » and « Retour au départ » from
 * client_feedback_2026_10_29_spec.md §D2.
 *
 * New controls are found by id or test id, not by their copy: the copy is
 * applied to messages/*.json as a patch, and these pass on either side of it.
 */

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="area-thumbnail" /> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const PLACES: Record<string, { label: string; lat: number; lng: number }> = {
  Paris: { label: "Paris", lat: 48.85, lng: 2.35 },
  Lyon: { label: "Lyon", lat: 45.76, lng: 4.84 },
};

// A town field that resolves a known name and reports anything else as
// unresolved, the way `CityField` does.
vi.mock("@/components/ui/city-field", () => ({
  CityField: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: { label: string } | null;
    onChange: (place: { label: string; lat: number; lng: number } | null) => void;
  }) => (
    <input
      id={id}
      data-testid={id}
      value={value?.label ?? ""}
      onChange={(event) => onChange(PLACES[event.target.value] ?? null)}
    />
  ),
}));
vi.mock("../AvailabilityField", () => ({
  AvailabilityField: ({
    id,
    days,
    onChange,
  }: {
    id?: string;
    days: string[];
    onChange: (patch: { days: string[] }) => void;
  }) => (
    <button id={id} data-testid="dates" onClick={() => onChange({ days: ["2026-12-01"] })}>
      {days.join(",")}
    </button>
  ),
}));

import { RouteSearchBar } from "../RouteSearchBar";
import {
  committedSearch,
  EMPTY_SEARCH,
  needsDeparture,
} from "../../hooks/useSearchDraft";
import { DEFAULT_JOB_FILTERS, DEFAULT_RADIUS_KM, type JobFilters } from "../../types";

const t = fr.jobBoard.route;
const paris = PLACES.Paris;
const lyon = PLACES.Lyon;

function renderCard(filters: Partial<JobFilters> = {}) {
  const onSearch = vi.fn();
  const onClear = vi.fn();
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris" onError={() => {}}>
      <RouteSearchBar
        filters={{ ...DEFAULT_JOB_FILTERS, ...filters }}
        onSearch={onSearch}
        onClear={onClear}
        onShowMap={vi.fn()}
      />
    </NextIntlClientProvider>
  );
  return { onSearch, onClear };
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const type = (id: string, value: string) =>
  fireEvent.change(field(id), { target: { value } });
const submit = () => fireEvent.click(screen.getByTestId("board-search-submit"));

beforeEach(() => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void) =>
        ok({ coords: { latitude: 48.856613, longitude: 2.352222 } }),
    },
  });
});

describe("the search card", () => {
  it("is one card with four labelled fields and one search button", () => {
    renderCard();

    const card = screen.getByTestId("board-search-card");
    for (const id of ["board-from", "board-to", "board-dates", "board-title"]) {
      expect(card.querySelector(`#${id}`)).not.toBeNull();
      expect(card.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
    expect(screen.getAllByTestId("board-search-submit")).toHaveLength(1);
    // The mode is read off the fields: there is no toggle to choose it on.
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("sends nothing until « Rechercher » is pressed", () => {
    const { onSearch } = renderCard();

    type("board-from", "Paris");
    type("board-title", "canapé");
    expect(onSearch).not.toHaveBeenCalled();

    submit();
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("searches around a departure alone, with a radius", () => {
    const { onSearch } = renderCard();

    type("board-from", "Paris");
    expect(screen.getByTestId("board-search-mode")).toHaveAttribute("data-mode", "around");
    submit();

    expect(onSearch).toHaveBeenCalledWith({
      ...EMPTY_SEARCH,
      from: paris,
      radiusKm: DEFAULT_RADIUS_KM,
    });
  });

  it("searches along the route once there is a destination", () => {
    const { onSearch } = renderCard();

    type("board-from", "Paris");
    type("board-to", "Lyon");
    expect(screen.getByTestId("board-search-mode")).toHaveAttribute("data-mode", "route");
    submit();

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ from: paris, to: lyon, radiusKm: DEFAULT_RADIUS_KM })
    );
  });

  it("sends the title, trimmed, and the dates with the rest", () => {
    const { onSearch } = renderCard();

    type("board-title", "  Canapé  ");
    fireEvent.click(screen.getByTestId("dates"));
    submit();

    expect(onSearch).toHaveBeenCalledWith({
      ...EMPTY_SEARCH,
      q: "Canapé",
      days: ["2026-12-01"],
    });
  });

  it("searches on Enter in the title box", () => {
    const { onSearch } = renderCard();

    type("board-title", "100042");
    fireEvent.keyDown(field("board-title"), {
      key: "Enter",
    });

    expect(onSearch).toHaveBeenCalledWith({ ...EMPTY_SEARCH, q: "100042" });
  });

  it("asks for a departure rather than send a destination alone", () => {
    const { onSearch } = renderCard();

    type("board-to", "Lyon");
    submit();

    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Naming the departure is the next step, and it clears the message.
    type("board-from", "Paris");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    submit();
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("opens on the committed search — a trip card's deep link", () => {
    renderCard({ from: paris, to: lyon, radiusKm: 75, q: "piano" });

    expect(screen.getByTestId("board-from")).toHaveValue("Paris");
    expect(screen.getByTestId("board-to")).toHaveValue("Lyon");
    expect(field("board-title")).toHaveValue("piano");
  });

  it("empties its fields and tells the board on « Effacer »", () => {
    const { onClear, onSearch } = renderCard({ from: paris, q: "piano" });

    fireEvent.click(screen.getByTestId("board-search-clear"));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByTestId("board-from")).toHaveValue("");
    expect(field("board-title")).toHaveValue("");
  });

  it("starts from the device's position, rounded", () => {
    const { onSearch } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: t.useMyPosition }));
    submit();

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { label: t.myPosition, lat: 48.8566, lng: 2.3522 },
        radiusKm: DEFAULT_RADIUS_KM,
      })
    );
  });

  it("makes the destination the departure for a round trip", () => {
    const { onSearch } = renderCard({ from: paris });

    fireEvent.click(screen.getByRole("button", { name: t.backToStart }));
    submit();

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ from: paris, to: paris }));
  });

  it("swaps the two ends, and only when both are named", () => {
    const { onSearch } = renderCard({ from: paris });
    const swap = screen.getByRole("button", { name: t.swap });
    expect(swap).toBeDisabled();

    type("board-to", "Lyon");
    fireEvent.click(swap);
    submit();

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ from: lyon, to: paris }));
  });

  it("drops the étapes with the destination they rode on", () => {
    const { onSearch } = renderCard({ from: paris, to: lyon, via: [paris] });

    type("board-to", "");
    submit();

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ to: null, via: [] }));
  });

  it("shows the area thumbnail only once there is a departure", () => {
    renderCard();
    expect(screen.queryByTestId("area-thumbnail")).not.toBeInTheDocument();

    type("board-from", "Paris");
    expect(screen.getByTestId("area-thumbnail")).toBeInTheDocument();
  });
});

describe("committedSearch", () => {
  it("gives a radius to a place and takes it from no place", () => {
    expect(committedSearch({ ...EMPTY_SEARCH, from: paris }).radiusKm).toBe(DEFAULT_RADIUS_KM);
    expect(committedSearch({ ...EMPTY_SEARCH, from: paris, radiusKm: 200 }).radiusKm).toBe(200);
    expect(committedSearch({ ...EMPTY_SEARCH, radiusKm: 200 }).radiusKm).toBeNull();
  });

  it("knows a destination alone is not a search", () => {
    expect(needsDeparture({ ...EMPTY_SEARCH, to: lyon })).toBe(true);
    expect(needsDeparture({ ...EMPTY_SEARCH, from: paris, to: lyon })).toBe(false);
    expect(needsDeparture(EMPTY_SEARCH)).toBe(false);
  });
});
