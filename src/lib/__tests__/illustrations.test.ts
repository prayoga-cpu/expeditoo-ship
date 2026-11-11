import { describe, expect, it } from "vitest";
import { guessIllustration, illustrationSrc, ILLUSTRATION_KINDS } from "../illustrations";

describe("guessIllustration", () => {
  it.each([
    ["Canapé deux places", "furniture"],
    ["baby foot", "furniture"],
    ["Armoire normande", "furniture"],
    ["Une palette de carrelage", "pallet"],
    ["Moto Yamaha", "vehicle"],
    ["UN TAPIS", "furniture"],
    ["Petit colis", "parcel"],
    ["", "parcel"],
  ])("%s → %s", (title, kind) => {
    expect(guessIllustration(title)).toBe(kind);
  });

  it("points at a file that exists for every kind", () => {
    for (const kind of ILLUSTRATION_KINDS) expect(illustrationSrc(kind)).toMatch(/^\/images\/illustrations\/\w+\.svg$/);
  });
});
