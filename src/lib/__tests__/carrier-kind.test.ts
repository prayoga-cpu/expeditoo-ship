import { describe, expect, it } from "vitest";

import { carrierKindEnum } from "@/db/schema/carriers";
import { CARRIER_KINDS, carrierKindLabel } from "../carrier-kind";

/** driver_types_spec.md §1 — one vocabulary for the two kinds. */
describe("carrierKindLabel", () => {
  it("covers the database enum exactly", () => {
    expect([...CARRIER_KINDS].sort()).toEqual([...carrierKindEnum.enumValues].sort());
  });

  it("names the two kinds in French by default", () => {
    expect(carrierKindLabel("private")).toBe("Particulier (interne)");
    expect(carrierKindLabel("professional")).toBe("Professionnel");
  });

  it("names them in English for an English locale", () => {
    expect(carrierKindLabel("private", "en")).toBe("Private (in-house)");
    expect(carrierKindLabel("professional", "en-GB")).toBe("Professional");
  });

  it("reads a file with no kind as professional, the column's default", () => {
    expect(carrierKindLabel(undefined)).toBe("Professionnel");
    expect(carrierKindLabel(null, "fr")).toBe("Professionnel");
  });
});
