import { describe, expect, it } from "vitest";

import { parseFrenchName } from "../french-names";

/**
 * The shapes real bordereaux print. `DUPONT Jean` and `M. Jean DUPONT` are the
 * same person written two ways, which is the whole reason the parser exists:
 * the old `split(" ")` read the first case backwards.
 */

const cases: [string, string | null, string | null][] = [
  ["DUPONT Jean", "Jean", "DUPONT"],
  ["M. Jean DUPONT", "Jean", "DUPONT"],
  ["Jean DUPONT", "Jean", "DUPONT"],
  ["Jean-Pierre DE LA TOUR", "Jean-Pierre", "DE LA TOUR"],
  ["MARTIN Marie-Claire", "Marie-Claire", "MARTIN"],
  ["Mme LE GALL Anne", "Anne", "LE GALL"],
  ["Mlle Anne-Sophie MARTIN-DUBOIS", "Anne-Sophie", "MARTIN-DUBOIS"],
  ["Dr Pierre VAN DAMME", "Pierre", "VAN DAMME"],
  ["Me Sophie D'ARGENT", "Sophie", "D'ARGENT"],
  ["Jean D. DUPONT", "Jean D.", "DUPONT"],
  ["Éric LEFÈVRE", "Éric", "LEFÈVRE"],
  ["Jean Dupont", "Jean", "Dupont"],
  ["Jean de la Tour", "Jean", "de la Tour"],
  ["JEAN DUPONT", "JEAN", "DUPONT"],
  ["Jean  DUPONT", "Jean", "DUPONT"],
  ["M. et Mme DUPONT", null, "DUPONT"],
  ["SARL Brocante du Centre", null, "SARL Brocante du Centre"],
  ["Brocante du Centre SARL", null, "Brocante du Centre SARL"],
  ["Succession DUPONT", null, "Succession DUPONT"],
  // A legal form is only a legal form at the edges. "Sa" here is a given name,
  // and reading it as Société Anonyme would drop the buyer's first name.
  ["Sa Thi NGUYEN", "Sa Thi", "NGUYEN"],
  ["DUPONT", null, "DUPONT"],
  ["de LA TOUR", null, "de LA TOUR"],
  ["M.", null, null],
  ["", null, null],
  ["   ", null, null],
];

describe("parseFrenchName", () => {
  it.each(cases)("%s -> %s / %s", (input, firstName, lastName) => {
    const parsed = parseFrenchName(input);
    expect(parsed.firstName).toBe(firstName);
    expect(parsed.lastName).toBe(lastName);
  });

  it("keeps the original recoverable whatever the split decided", () => {
    expect(parseFrenchName("  Mme  LE GALL   Anne ").fullName).toBe(
      "Mme LE GALL Anne"
    );
    expect(parseFrenchName(null).fullName).toBeNull();
  });
});
