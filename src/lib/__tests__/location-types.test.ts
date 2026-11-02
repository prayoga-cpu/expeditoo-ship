import { describe, expect, it } from "vitest";

import { locationTypeEnum } from "@/db/schema/listings";
import { LOCATION_TYPES as DTO_TYPES } from "@/server/dto/listings.dto";
import { LOCATION_TYPES as FORM_TYPES } from "@/features/app/create/schemas";
import {
  floorRequired,
  hasFloors,
  liftRequired,
  LOCATION_TYPES,
} from "../location-types";

/** client_feedback_2026_10_31_spec.md §3, §8. */
describe("LOCATION_TYPES", () => {
  it("is the one list the enum, the DTO and the form read", () => {
    expect(locationTypeEnum.enumValues).toEqual([...LOCATION_TYPES]);
    expect(DTO_TYPES).toBe(LOCATION_TYPES);
    expect(FORM_TYPES).toBe(LOCATION_TYPES);
  });

  it("offers « Commissaire-priseur » right after « Commerce »", () => {
    const at = LOCATION_TYPES.indexOf("auction_house");
    expect(LOCATION_TYPES[at - 1]).toBe("shop");
  });
});

describe("floors", () => {
  it("has floors where the floor changes the job, not at a dock", () => {
    for (const type of ["house", "apartment", "office", "shop", "auction_house", "storage_unit", "other"]) {
      expect(hasFloors(type)).toBe(true);
    }
    for (const type of ["warehouse", "factory", "construction_site", "farm", "port", "airport", "rail_terminal"]) {
      expect(hasFloors(type)).toBe(false);
    }
  });

  it("asks an apartment its floor always, a house only on a move", () => {
    expect(floorRequired("apartment", false)).toBe(true);
    expect(floorRequired("house", false)).toBe(false);
    expect(floorRequired("house", true)).toBe(true);
    expect(floorRequired("warehouse", true)).toBe(false);
  });

  it("asks the lift from the first floor up, where the floor is asked", () => {
    expect(liftRequired("apartment", false, 0)).toBe(false);
    expect(liftRequired("apartment", false, 1)).toBe(true);
    expect(liftRequired("apartment", false, undefined)).toBe(false);
    expect(liftRequired("house", false, 3)).toBe(false);
    expect(liftRequired("house", true, 3)).toBe(true);
  });
});
