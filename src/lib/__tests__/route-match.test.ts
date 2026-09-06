import { describe, it, expect } from "vitest";
import {
  matchRoute,
  MAX_RUNS_SHOWN,
  type MatchTarget,
  type MatchableTrajet,
} from "@/lib/route-match";
import { corridorPath, positionOnPath } from "@/lib/route-corridor";

// The same corridor `route-corridor.test.ts` argues about, read from the other
// side: there the trajet hunts jobs, here the job hunts trajets.
const BORDEAUX = { lat: 44.84, lng: -0.58 };
const PARIS = { lat: 48.86, lng: 2.35 };
// On the Bordeaux → Paris axis: 10.2 km and 17.0 km off it respectively.
const ANGOULEME = { lat: 45.65, lng: 0.16 };
const ORLEANS = { lat: 47.9, lng: 1.9 };
// Well off it.
const LYON = { lat: 45.76, lng: 4.84 };
const TOULOUSE = { lat: 43.6, lng: 1.44 };

// Every test pins its clock: a suite that reads the wall clock passes in
// September and fails in October.
const NOW = new Date(2026, 8, 1, 9, 0, 0); // Tuesday 1 September 2026.

// ISO weekdays, as the schema stores them (Sunday is 7, not 0).
const MONDAY = 1;
const WEDNESDAY = 3;
const SUNDAY = 7;

const trajet = (overrides: Partial<MatchableTrajet> = {}): MatchableTrajet => ({
  kind: "recurring",
  daysOfWeek: [WEDNESDAY],
  dates: [],
  validFrom: null,
  validUntil: null,
  originLat: BORDEAUX.lat,
  originLng: BORDEAUX.lng,
  destinationLat: PARIS.lat,
  destinationLng: PARIS.lng,
  radiusKm: 75,
  capacityKg: null,
  ...overrides,
});

const job = (overrides: Partial<MatchTarget> = {}): MatchTarget => ({
  pickup: ANGOULEME,
  dropoff: ORLEANS,
  pickupFrom: new Date(2026, 8, 1),
  pickupUntil: new Date(2026, 8, 10, 23, 59, 59),
  weightKg: 200,
  ...overrides,
});

describe("matchRoute — geometry", () => {
  it("matches a job that lies along the trajet", () => {
    const match = matchRoute(trajet(), job(), NOW);

    expect(match).not.toBeNull();
    // Wednesdays inside the window: the 2nd and the 9th.
    expect(match!.runs.map((run) => run.getDate())).toEqual([2, 9]);
  });

  it("refuses a job whose far end leaves the corridor", () => {
    expect(matchRoute(trajet(), job({ dropoff: LYON }), NOW)).toBeNull();
  });

  it("refuses a job that never enters the corridor at all", () => {
    expect(
      matchRoute(trajet(), job({ pickup: TOULOUSE, dropoff: LYON }), NOW)
    ).toBeNull();
  });

  it("applies the trajet's own radius, not a platform-wide one", () => {
    // Orléans sits 17 km off the line, Angoulême 10.2 km: a 15 km tolerance
    // admits the pickup and refuses the dropoff, so both ends are tested.
    expect(matchRoute(trajet({ radiusKm: 15 }), job(), NOW)).toBeNull();
    expect(matchRoute(trajet({ radiusKm: 25 }), job(), NOW)).not.toBeNull();
  });

  it("refuses the same job travelling against the trajet", () => {
    // The direction rule: a driver heading north is not shown a load heading
    // south, however tightly it hugs their line.
    const southbound = job({ pickup: ORLEANS, dropoff: ANGOULEME });

    expect(matchRoute(trajet(), southbound, NOW)).toBeNull();
    // And it is direction alone that refuses it — the two endpoints are the
    // ones the northbound job matched on.
    expect(matchRoute(trajet(), job(), NOW)).not.toBeNull();
  });
});

describe("matchRoute — detourKm", () => {
  it("reports the worse endpoint, not the better and not the mean", () => {
    const path = corridorPath([BORDEAUX, PARIS]);
    const pickupDetour = positionOnPath(path, ANGOULEME).detourKm;
    const dropoffDetour = positionOnPath(path, ORLEANS).detourKm;

    // The three candidate answers are far enough apart that the assertion has
    // teeth: ~10.2, ~13.6 and ~17.0 km.
    expect(dropoffDetour).toBeGreaterThan(pickupDetour + 5);

    const match = matchRoute(trajet(), job(), NOW);

    expect(match!.detourKm).toBeCloseTo(dropoffDetour, 9);
    expect(match!.detourKm).not.toBeCloseTo(pickupDetour, 3);
    expect(match!.detourKm).not.toBeCloseTo(
      (pickupDetour + dropoffDetour) / 2,
      3
    );
  });

  it("reads the worse end whichever end it is", () => {
    // Bordeaux is the trajet's own origin, so the pickup is now the clean end
    // and the dropoff the ragged one — the max must follow, not the field.
    const path = corridorPath([BORDEAUX, PARIS]);
    const match = matchRoute(trajet(), job({ pickup: BORDEAUX }), NOW);

    expect(match!.detourKm).toBeCloseTo(
      positionOnPath(path, ORLEANS).detourKm,
      9
    );
    expect(match!.detourKm).toBeGreaterThan(0);
  });
});

describe("matchRoute — recurring trajets", () => {
  it("matches when the weekday falls inside the pickup window", () => {
    const match = matchRoute(trajet({ daysOfWeek: [WEDNESDAY] }), job(), NOW);

    expect(match!.runs.map((run) => run.getDate())).toEqual([2, 9]);
  });

  it("refuses when the weekday falls outside it", () => {
    // The window closes on Friday the 4th; the first Sunday is the 6th.
    const shortWindow = job({ pickupUntil: new Date(2026, 8, 4, 23, 59, 59) });

    expect(
      matchRoute(trajet({ daysOfWeek: [SUNDAY] }), shortWindow, NOW)
    ).toBeNull();
  });

  it("starts the walk at the window rather than at today", () => {
    const future = job({
      pickupFrom: new Date(2026, 8, 15),
      pickupUntil: new Date(2026, 8, 30, 23, 59, 59),
    });

    const match = matchRoute(trajet({ daysOfWeek: [WEDNESDAY] }), future, NOW);

    // Wednesdays from the 16th on, never the 2nd or 9th the window excludes.
    expect(match!.runs.map((run) => run.getDate())).toEqual([16, 23, 30]);
  });

  it("never offers a run that has already passed", () => {
    // A window that opened before today: the walk starts at now, so last
    // Monday is gone even though it sits inside the window.
    const opened = job({
      pickupFrom: new Date(2026, 7, 15),
      pickupUntil: new Date(2026, 8, 10, 23, 59, 59),
    });

    const match = matchRoute(trajet({ daysOfWeek: [MONDAY] }), opened, NOW);

    expect(match!.runs.map((run) => run.getDate())).toEqual([7]);
  });

  it("refuses a trajet whose validity has expired", () => {
    expect(
      matchRoute(trajet({ validUntil: new Date(2026, 7, 20) }), job(), NOW)
    ).toBeNull();
  });

  it("refuses a trajet that names no weekday", () => {
    expect(matchRoute(trajet({ daysOfWeek: [] }), job(), NOW)).toBeNull();
  });
});

describe("matchRoute — occasional trajets", () => {
  const occasional = (dates: Date[]) =>
    trajet({
      kind: "occasional",
      daysOfWeek: [],
      dates: dates.map((date) => ({ date })),
    });

  it("matches on a stored date inside the window", () => {
    const match = matchRoute(occasional([new Date(2026, 8, 8)]), job(), NOW);

    expect(match!.runs.map((run) => run.getDate())).toEqual([8]);
  });

  it("refuses a stored date after the window closes", () => {
    expect(
      matchRoute(occasional([new Date(2026, 8, 20)]), job(), NOW)
    ).toBeNull();
  });

  it("refuses a stored date that has already passed", () => {
    const opened = job({ pickupFrom: new Date(2026, 7, 15) });

    expect(
      matchRoute(occasional([new Date(2026, 7, 20)]), opened, NOW)
    ).toBeNull();
  });

  it("refuses a trajet with no dates at all", () => {
    expect(matchRoute(occasional([]), job(), NOW)).toBeNull();
  });
});

describe("matchRoute — capacity", () => {
  it("refuses a trajet that cannot carry the load", () => {
    expect(
      matchRoute(trajet({ capacityKg: 500 }), job({ weightKg: 800 }), NOW)
    ).toBeNull();
  });

  it("admits a load exactly at the declared capacity", () => {
    expect(
      matchRoute(trajet({ capacityKg: 800 }), job({ weightKg: 800 }), NOW)
    ).not.toBeNull();
  });

  it("does not exclude a trajet that declares no capacity", () => {
    expect(
      matchRoute(trajet({ capacityKg: null }), job({ weightKg: 800 }), NOW)
    ).not.toBeNull();
  });
});

describe("matchRoute — runs", () => {
  const everyDay = trajet({ daysOfWeek: [1, 2, 3, 4, 5, 6, 7] });
  const month = job({
    pickupFrom: new Date(2026, 8, 1),
    pickupUntil: new Date(2026, 8, 30, 23, 59, 59),
  });

  it("caps what one card carries", () => {
    const match = matchRoute(everyDay, month, NOW);

    expect(match!.runs).toHaveLength(MAX_RUNS_SHOWN);
  });

  it("keeps the soonest first", () => {
    const match = matchRoute(everyDay, month, NOW);
    const times = match!.runs.map((run) => run.getTime());

    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(match!.runs.map((run) => run.getDate())).toEqual([1, 2, 3]);
  });

  it("puts the soonest first for an occasional trajet too", () => {
    const shuffled = trajet({
      kind: "occasional",
      daysOfWeek: [],
      dates: [
        { date: new Date(2026, 8, 9) },
        { date: new Date(2026, 8, 3) },
        { date: new Date(2026, 8, 6) },
      ],
    });

    const match = matchRoute(shuffled, job(), NOW);

    expect(match!.runs.map((run) => run.getDate())).toEqual([3, 6, 9]);
  });
});
