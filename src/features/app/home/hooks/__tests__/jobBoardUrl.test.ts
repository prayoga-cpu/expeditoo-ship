import { describe, it, expect } from "vitest";
import {
  filtersFromParams,
  paramsFromFilters,
} from "../useJobBoard";
import { DEFAULT_JOB_FILTERS, type JobFilters } from "../../types";

const parse = (search: string) => filtersFromParams(new URLSearchParams(search));

describe("filtersFromParams", () => {
  it("reads a corridor deep link", () => {
    // What a trip card's "voir les courses correspondantes" now produces. The
    // board used to ignore this entirely, which is why the link did nothing.
    const filters = parse(
      "fromLat=44.84&fromLng=-0.58&fromLabel=Bordeaux&toLat=48.86&toLng=2.35&toLabel=Paris&radiusKm=75"
    );

    expect(filters.from).toEqual({ label: "Bordeaux", lat: 44.84, lng: -0.58 });
    expect(filters.to).toEqual({ label: "Paris", lat: 48.86, lng: 2.35 });
    expect(filters.radiusKm).toBe(75);
  });

  it("falls back to the coordinates when a link carries no label", () => {
    const filters = parse("fromLat=44.84&fromLng=-0.58");

    expect(filters.from?.label).toBe("44.840, -0.580");
  });

  it("drops an arrival that arrives without a departure", () => {
    // An arrival on its own describes no corridor.
    expect(parse("toLat=48.86&toLng=2.35").to).toBeNull();
  });

  it("ignores a half-specified point", () => {
    expect(parse("fromLat=44.84").from).toBeNull();
  });

  it("keeps only well-formed days", () => {
    const filters = parse("days=2026-09-02,rubbish,2026-09-05");

    expect(filters.days).toEqual(["2026-09-02", "2026-09-05"]);
  });

  it("keeps only known slots", () => {
    expect(parse("slots=morning,lunchtime").slots).toEqual(["morning"]);
  });

  it("ignores a sort it does not offer", () => {
    expect(parse("sort=cheapest").sort).toBe("created_desc");
  });

  it("returns the defaults for an empty query", () => {
    expect(parse("")).toEqual(DEFAULT_JOB_FILTERS);
  });
});

describe("paramsFromFilters", () => {
  const filters: JobFilters = {
    ...DEFAULT_JOB_FILTERS,
    q: "piano",
    from: { label: "Bordeaux", lat: 44.84, lng: -0.58 },
    to: { label: "Paris", lat: 48.86, lng: 2.35 },
    radiusKm: 75,
    days: ["2026-09-02"],
    slots: ["morning"],
  };

  it("round-trips through the URL", () => {
    expect(filtersFromParams(paramsFromFilters(filters))).toEqual(filters);
  });

  it("writes nothing for the default filters", () => {
    expect(paramsFromFilters(DEFAULT_JOB_FILTERS).toString()).toBe("");
  });

  it("omits the arrival when there is no departure", () => {
    const written = paramsFromFilters({
      ...filters,
      from: null,
    });

    expect(written.get("toLat")).toBeNull();
    expect(written.get("radiusKm")).toBeNull();
  });

  it("omits slots when no day is chosen", () => {
    // A time of day with no date is not a constraint.
    const written = paramsFromFilters({ ...filters, days: [] });

    expect(written.get("slots")).toBeNull();
  });
});
