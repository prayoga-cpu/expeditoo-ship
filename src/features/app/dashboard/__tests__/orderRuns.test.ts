import { describe, it, expect } from "vitest";
import { orderRunsByProgress, type OrderableRun } from "../orderRuns";

const run = (
  id: string,
  status: string,
  scheduledPickup: string | null = null
) => ({ id, status, scheduledPickup }) as OrderableRun & { id: string };

describe("orderRunsByProgress", () => {
  // The regression this exists for: the API returns newest-first, so the job
  // won most recently outranked the one the driver was physically driving.
  it("leads with the run underway, not the one most recently awarded", () => {
    const inTransitFromMonday = run("monday", "IN_TRANSIT");
    const pendingFromTuesday = run("tuesday", "PENDING");

    const ordered = orderRunsByProgress([
      pendingFromTuesday, // as the API returns it: newest first
      inTransitFromMonday,
    ]);

    expect(ordered[0].id).toBe("monday");
  });

  it("ranks every stage from most to least underway", () => {
    const ordered = orderRunsByProgress([
      run("d", "PENDING"),
      run("b", "PICKED_UP"),
      run("a", "IN_TRANSIT"),
      run("c", "ASSIGNED"),
    ]);

    expect(ordered.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("breaks ties on the most imminent pickup", () => {
    const ordered = orderRunsByProgress([
      run("later", "ASSIGNED", "2026-03-02T09:00:00.000Z"),
      run("sooner", "ASSIGNED", "2026-03-01T09:00:00.000Z"),
    ]);

    expect(ordered.map((r) => r.id)).toEqual(["sooner", "later"]);
  });

  it("sorts unscheduled runs after scheduled ones", () => {
    const ordered = orderRunsByProgress([
      run("unscheduled", "ASSIGNED", null),
      run("scheduled", "ASSIGNED", "2026-03-01T09:00:00.000Z"),
    ]);

    expect(ordered.map((r) => r.id)).toEqual(["scheduled", "unscheduled"]);
  });

  // A status outside the active set should never be promoted to "current run".
  it("sorts an unknown status last rather than first", () => {
    const ordered = orderRunsByProgress([
      run("weird", "SOMETHING_NEW"),
      run("real", "PENDING"),
    ]);

    expect(ordered.map((r) => r.id)).toEqual(["real", "weird"]);
  });

  it("does not mutate the array it is given", () => {
    const input = [run("b", "PENDING"), run("a", "IN_TRANSIT")];
    const before = input.map((r) => r.id);

    orderRunsByProgress(input);

    expect(input.map((r) => r.id)).toEqual(before);
  });

  it("handles an empty list", () => {
    expect(orderRunsByProgress([])).toEqual([]);
  });
});
