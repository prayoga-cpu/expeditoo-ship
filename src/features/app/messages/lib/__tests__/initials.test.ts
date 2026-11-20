import { describe, expect, it } from "vitest";

import { initialsOf } from "../initials";

/** client feedback 2026-11-19, #32 */
describe("initialsOf", () => {
  it("takes the first letter of the first name and of the last name", () => {
    expect(initialsOf({ firstName: "Nicolas", lastName: "Martin", name: "Nicolas Martin" })).toBe("NM");
  });

  it("prefers the two fields over the composed name", () => {
    expect(
      initialsOf({ firstName: "Marie", lastName: "de la Tour", name: "Marie de la Tour" })
    ).toBe("MD");
  });

  it("keeps accents and upper-cases", () => {
    expect(initialsOf({ firstName: "élodie", lastName: "öztürk" })).toBe("ÉÖ");
    expect(initialsOf({ name: "Émile Zola" })).toBe("ÉZ");
  });

  it("falls back to the first and last word of the name", () => {
    expect(initialsOf({ name: "Jean Pierre Dupont" })).toBe("JD");
    expect(initialsOf({ firstName: null, lastName: null, name: "  ana   silva " })).toBe("AS");
  });

  it("gives one letter for a one-word name", () => {
    expect(initialsOf({ name: "Expedion" })).toBe("E");
    expect(initialsOf({ firstName: "Chloé", lastName: null, name: "Chloé" })).toBe("C");
  });

  it("uses the one field it has when the name is empty", () => {
    expect(initialsOf({ firstName: "Chloé", name: "" })).toBe("C");
  });

  it("skips punctuation in front of a word", () => {
    expect(initialsOf({ name: "« Paul » (test) Durand" })).toBe("PD");
    expect(initialsOf({ name: "- - Léa" })).toBe("L");
  });

  it("answers « ? » for nothing at all", () => {
    expect(initialsOf({})).toBe("?");
    expect(initialsOf({ firstName: "", lastName: " ", name: "   " })).toBe("?");
    expect(initialsOf({ name: null })).toBe("?");
  });

  it("does not cut a character outside the basic plane in half", () => {
    expect(initialsOf({ name: "𝒜lice 𝒵ed" })).toBe("𝒜𝒵");
  });
});
