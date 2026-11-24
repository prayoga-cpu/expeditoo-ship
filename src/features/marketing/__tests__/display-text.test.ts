import { describe, expect, it } from "vitest";
import { titleAsSentence, townAsName } from "../display-text";

/** landing_2026_11_spec.md §4.4 — casing on a public card, and only casing. */
describe("townAsName", () => {
  it.each([
    ["MARSEILLE", "Marseille"],
    ["bayonne", "Bayonne"],
    ["AIX-EN-PROVENCE", "Aix-en-Provence"],
    ["boulogne-sur-mer", "Boulogne-sur-Mer"],
    ["saint-étienne", "Saint-Étienne"],
    ["l'haÿ-les-roses", "L'Haÿ-les-Roses"],
    ["paris 9e", "Paris 9e"],
  ])("shows %s as %s", (typed, shown) => {
    expect(townAsName(typed, "fr")).toBe(shown);
  });

  it("leaves a name typed with care exactly as it is", () => {
    expect(townAsName("Saint-Malo", "fr")).toBe("Saint-Malo");
    expect(townAsName("La Roche-sur-Yon", "fr")).toBe("La Roche-sur-Yon");
    expect(townAsName("McAllen", "en")).toBe("McAllen");
  });
});

describe("titleAsSentence", () => {
  it("capitalises the first letter and nothing else", () => {
    expect(titleAsSentence("canape deux places", "fr")).toBe("Canape deux places");
    expect(titleAsSentence("TV 55 pouces", "fr")).toBe("TV 55 pouces");
  });

  it("turns a title shouted in capitals into a sentence", () => {
    expect(titleAsSentence("ARMOIRE NORMANDE", "fr")).toBe("Armoire normande");
  });
});
