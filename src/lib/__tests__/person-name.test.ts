import { describe, expect, it } from "vitest";

import { aliasSchema, composeName, namePartSchema, splitName } from "../person-name";

/** client_feedback_2026_10_spec.md §1 — one definition of a name in parts. */

describe("person-name", () => {
  it("composes the display name from the parts", () => {
    expect(composeName(" Jean ", " Dupont ")).toBe("Jean Dupont");
  });

  it("splits a whole name into a prefill, first word first", () => {
    expect(splitName("Jean Dupont")).toEqual({ firstName: "Jean", lastName: "Dupont" });
    expect(splitName("Marie Anne de La Tour")).toEqual({
      firstName: "Marie",
      lastName: "Anne de La Tour",
    });
    expect(splitName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
    expect(splitName(null)).toEqual({ firstName: "", lastName: "" });
  });

  it("bounds a name part at 1–80 characters and an alias at 40", () => {
    expect(namePartSchema.safeParse("").success).toBe(false);
    expect(namePartSchema.safeParse("x".repeat(80)).success).toBe(true);
    expect(namePartSchema.safeParse("x".repeat(81)).success).toBe(false);
    expect(aliasSchema.safeParse("").success).toBe(true);
    expect(aliasSchema.safeParse("x".repeat(41)).success).toBe(false);
  });
});
