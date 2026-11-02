import { describe, expect, it } from "vitest";

import {
  countryCodeFrom,
  countryMapBounds,
  countryName,
  isInCountry,
  isJobCountry,
  isValidPostalCode,
  JOB_COUNTRIES,
  postalCodeExample,
} from "../countries";

/** client_feedback_2026_10_31_spec.md §6 — a country per end of a request. */

/** A point well inside each country: its capital, or close to it. */
const CAPITALS: Record<(typeof JOB_COUNTRIES)[number], [number, number]> = {
  FR: [48.8566, 2.3522],
  MC: [43.7384, 7.4246],
  BE: [50.8503, 4.3517],
  LU: [49.6116, 6.1319],
  NL: [52.3676, 4.9041],
  DE: [52.52, 13.405],
  CH: [46.948, 7.4474],
  AT: [48.2082, 16.3738],
  IT: [41.9028, 12.4964],
  ES: [40.4168, -3.7038],
  PT: [38.7223, -9.1393],
  PL: [52.2297, 21.0122],
  CZ: [50.0755, 14.4378],
  RO: [44.4268, 26.1025],
};

describe("JOB_COUNTRIES", () => {
  it("starts with France, the default", () => {
    expect(JOB_COUNTRIES[0]).toBe("FR");
  });

  it.each(JOB_COUNTRIES)("%s accepts its own example and puts its capital inside", (code) => {
    expect(isValidPostalCode(code, postalCodeExample(code))).toBe(true);
    const [lat, lng] = CAPITALS[code];
    expect(isInCountry(code, lat, lng)).toBe(true);
  });
});

describe("isValidPostalCode", () => {
  it.each([
    ["FR", "1000", false],
    ["BE", "75011", false],
    ["NL", "1012AB", true],
    ["NL", "1012 ab", true],
    ["PT", "1100148", false],
    ["CZ", "11000", true],
    ["RO", "01001", false],
  ])("%s %j: %s", (country, code, expected) => {
    expect(isValidPostalCode(country, code)).toBe(expected);
  });

  it("holds an absent or unknown country to France's format", () => {
    expect(isValidPostalCode(undefined, "75011")).toBe(true);
    expect(isValidPostalCode("US", "1000")).toBe(false);
  });
});

describe("isInCountry", () => {
  it("refuses Berlin as French and Paris as German", () => {
    expect(isInCountry("FR", 52.52, 13.405)).toBe(false);
    expect(isInCountry("DE", 48.8566, 2.3522)).toBe(false);
  });

  it("keeps France's box: Corsica in, London out", () => {
    expect(isInCountry("FR", 41.9192, 8.7386)).toBe(true);
    expect(isInCountry("FR", 51.5, -0.12)).toBe(false);
  });
});

describe("countryCodeFrom", () => {
  it.each([
    ["France", "FR"],
    ["fr", "FR"],
    ["  Belgique ", "BE"],
    ["Belgium", "BE"],
    ["Österreich", "AT"],
    ["autriche", "AT"],
    ["République tchèque", "CZ"],
    ["Pays-Bas", "NL"],
    ["USA", "US"],
    ["États-Unis", "US"],
    ["Royaume-Uni", "GB"],
    ["de", "DE"],
  ])("%j → %s", (text, code) => {
    expect(countryCodeFrom(text)).toBe(code);
  });

  it.each(["", "   ", null, undefined, "non précisé", "Atlantis"])(
    "%j → nothing",
    (text) => {
      expect(countryCodeFrom(text)).toBeNull();
    }
  );
});

describe("the rest", () => {
  it("knows which codes a request may be posted to", () => {
    expect(isJobCountry("BE")).toBe(true);
    expect(isJobCountry("US")).toBe(false);
    expect(isJobCountry(undefined)).toBe(false);
  });

  it("names a country in the reader's language", () => {
    expect(countryName("BE", "fr")).toBe("Belgique");
    expect(countryName("BE", "en")).toBe("Belgium");
  });

  it("pads the map's bounds around the box", () => {
    const [[west, south], [east, north]] = countryMapBounds("BE");
    expect(west).toBeLessThan(2.5);
    expect(east).toBeGreaterThan(6.45);
    expect(south).toBeLessThan(49.45);
    expect(north).toBeGreaterThan(51.55);
  });
});
