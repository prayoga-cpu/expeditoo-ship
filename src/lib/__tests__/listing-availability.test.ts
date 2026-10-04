import { describe, expect, it } from "vitest";

import fr from "../../../messages/fr.json";
import { describeAvailability } from "../listing-availability";
import type { IsoWeekday, TimeSlot } from "../availability-window";

/**
 * One end of a request's weekdays and times of day, read back
 * (request_availability_spec.md §6).
 */

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const ALL_PERIODS: TimeSlot[] = ["morning", "afternoon", "evening"];
const day = (d: IsoWeekday) => fr.create.when.weekdays[String(d) as "1"];
const period = (p: TimeSlot) => fr.create.when.slot[p];
const describe_ = (days?: number[], periods?: TimeSlot[]) =>
  describeAvailability(days, periods, day, period);

describe("describeAvailability", () => {
  it("says nothing for an unrestricted end", () => {
    expect(describe_(ALL_DAYS, ALL_PERIODS)).toBeNull();
    expect(describe_(undefined, undefined)).toBeNull();
    expect(describe_([], [])).toBeNull();
  });

  it("joins a run of three or more weekdays", () => {
    expect(describe_([1, 2, 3, 4, 5], ALL_PERIODS)).toBe("Lun–Ven");
  });

  it("lists shorter runs day by day", () => {
    expect(describe_([1, 2, 4], ALL_PERIODS)).toBe("Lun, Mar, Jeu");
  });

  it("keeps separate runs apart", () => {
    expect(describe_([1, 2, 3, 5, 6, 7], ALL_PERIODS)).toBe("Lun–Mer, Ven–Dim");
  });

  it("does not run Sunday on into Monday", () => {
    expect(describe_([7, 6, 1], ALL_PERIODS)).toBe("Lun, Sam, Dim");
  });

  it("names times of day in the order of a day", () => {
    expect(describe_(ALL_DAYS, ["evening", "morning"])).toBe("Matin, Soir");
  });

  it("puts weekdays before times of day", () => {
    expect(describe_([1, 2, 3, 4, 5], ["afternoon"])).toBe("Lun–Ven · Après-midi");
  });
});
