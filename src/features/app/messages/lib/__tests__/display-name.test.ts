import { describe, expect, it } from "vitest";

import { displayNameOf, pseudoOf } from "../display-name";

/** client feedback 2026-11-19, #32 */
describe("displayNameOf", () => {
  it("shows the pseudo, as « @pseudo », when there is one", () => {
    expect(displayNameOf({ name: "Nicolas Martin", alias: "Nico-Trans" })).toBe("@Nico-Trans");
  });

  it("falls back to the name without one", () => {
    expect(displayNameOf({ name: "Nicolas Martin", alias: null })).toBe("Nicolas Martin");
    expect(displayNameOf({ name: "Nicolas Martin", alias: "   " })).toBe("Nicolas Martin");
    expect(displayNameOf({ name: "Nicolas Martin" })).toBe("Nicolas Martin");
  });

  it("does not double an « @ » the person typed", () => {
    expect(pseudoOf({ alias: "@nico" })).toBe("@nico");
    expect(pseudoOf({ alias: "@" })).toBeNull();
  });

  it("is empty for nobody, so the caller's « unknown » applies", () => {
    expect(displayNameOf(null)).toBe("");
    expect(displayNameOf(undefined)).toBe("");
    expect(pseudoOf(null)).toBeNull();
  });
});
