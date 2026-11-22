import { describe, expect, it } from "vitest";

import {
  countryCodeFrom,
  countryMapBounds,
  countryMapCenter,
  countryName,
  countryOptions,
  FREQUENT_COUNTRIES,
  geocoderScope,
  isDetailedCountry,
  isInCountry,
  isJobCountry,
  isPostalCodeRequired,
  isValidPostalCode,
  JOB_COUNTRIES,
  postalCodeExample,
  WORLD_VIEW,
} from "../countries";

/**
 * client_feedback_2026_10_31_spec.md §6 — a country per end of a request;
 * postal_codes_abroad_spec.md §5 — every country, in two tiers.
 */

/** A point well inside each country: its capital, or close to it. */
const CAPITALS: Record<(typeof FREQUENT_COUNTRIES)[number], [number, number]> = {
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
  it("is every ISO 3166-1 country and territory, each once", () => {
    expect(JOB_COUNTRIES).toHaveLength(249);
    expect(new Set(JOB_COUNTRIES).size).toBe(249);
    for (const code of JOB_COUNTRIES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("holds the fourteen it always had, and the rest of the world", () => {
    for (const code of FREQUENT_COUNTRIES) expect(JOB_COUNTRIES).toContain(code);
    for (const code of ["US", "GB", "MA", "SN", "JP", "RE", "GP", "CA", "AU", "HK"]) {
      expect(JOB_COUNTRIES).toContain(code);
    }
  });

  it("has a name of its own for every code, in French and in English", () => {
    for (const locale of ["fr", "en"]) {
      const names = JOB_COUNTRIES.map((code) => countryName(code, locale));
      expect(names.filter((name, i) => name === JOB_COUNTRIES[i])).toEqual([]);
      expect(new Set(names).size).toBe(249);
    }
  });
});

describe("FREQUENT_COUNTRIES — the detailed tier", () => {
  it("starts with France, the default", () => {
    expect(FREQUENT_COUNTRIES[0]).toBe("FR");
    expect(FREQUENT_COUNTRIES).toHaveLength(14);
  });

  it.each(FREQUENT_COUNTRIES)("%s accepts its own example and puts its capital inside", (code) => {
    expect(isDetailedCountry(code)).toBe(true);
    expect(isPostalCodeRequired(code)).toBe(true);
    expect(isValidPostalCode(code, postalCodeExample(code) ?? "")).toBe(true);
    expect(isValidPostalCode(code, "")).toBe(false);
    const [lat, lng] = CAPITALS[code];
    expect(isInCountry(code, lat, lng)).toBe(true);
    expect(countryMapBounds(code)).toBeDefined();
  });
});

describe("a generic country — everywhere else", () => {
  it.each(["US", "GB", "MA", "SN", "JP", "RE", "GP"])("%s has no rule of its own", (code) => {
    expect(isJobCountry(code)).toBe(true);
    expect(isDetailedCountry(code)).toBe(false);
    expect(isPostalCodeRequired(code)).toBe(false);
    expect(postalCodeExample(code)).toBeNull();
    expect(countryMapBounds(code)).toBeUndefined();
    expect(countryMapCenter(code)).toEqual(WORLD_VIEW);
  });

  it("takes no postal code, or anything shaped like one", () => {
    expect(isValidPostalCode("HK", "")).toBe(true);
    expect(isValidPostalCode("HK", "   ")).toBe(true);
    expect(isValidPostalCode("GB", "SW1A 1AA")).toBe(true);
    expect(isValidPostalCode("US", "10001")).toBe(true);
    expect(isValidPostalCode("US", "10001-1234")).toBe(true);
    expect(isValidPostalCode("CA", "K1A 0B1")).toBe(true);
    expect(isValidPostalCode("JP", "100-0001")).toBe(true);
    expect(isValidPostalCode("IS", "101")).toBe(true);
  });

  it("refuses what no country writes", () => {
    expect(isValidPostalCode("US", "1")).toBe(false);
    expect(isValidPostalCode("US", "1234567890123")).toBe(false);
    expect(isValidPostalCode("US", "10001!")).toBe(false);
    expect(isValidPostalCode("US", "-10001")).toBe(false);
  });

  it("refuses no pin: there is no box to be outside of", () => {
    expect(isInCountry("US", 40.7128, -74.006)).toBe(true);
    expect(isInCountry("JP", 35.68, 139.69)).toBe(true);
    expect(isInCountry("RE", -20.88, 55.45)).toBe(true);
  });

  // The fallback that went: an unknown code used to be held to France's
  // pattern and France's box.
  it("is never held to France's rule — nor is a code nobody assigned", () => {
    for (const code of ["US", "XX", "ZZ"]) {
      expect(isValidPostalCode(code, "1000")).toBe(true); // not 5 digits
      expect(isValidPostalCode(code, "")).toBe(true);
      expect(isInCountry(code, 52.52, 13.405)).toBe(true); // Berlin
      expect(postalCodeExample(code)).not.toBe("75011");
      expect(countryMapBounds(code)).toBeUndefined();
    }
    expect(isJobCountry("XX")).toBe(false);
  });

  it("only an absent country is France", () => {
    for (const absent of [undefined, null, ""]) {
      expect(isValidPostalCode(absent, "75011")).toBe(true);
      expect(isValidPostalCode(absent, "1000")).toBe(false);
      expect(isValidPostalCode(absent, "")).toBe(false);
      expect(isInCountry(absent, 52.52, 13.405)).toBe(false);
      expect(postalCodeExample(absent)).toBe("75011");
    }
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
    // 2.94.0: any country, in French or in English, from the runtime's table.
    ["Maroc", "MA"],
    ["Morocco", "MA"],
    ["Sénégal", "SN"],
    ["senegal", "SN"],
    ["Japon", "JP"],
    ["Japan", "JP"],
    ["Côte d'Ivoire", "CI"],
    ["Ivory Coast", "CI"],
    ["La Réunion", "RE"],
    ["Guadeloupe", "GP"],
    ["Canada", "CA"],
    ["Émirats arabes unis", "AE"],
    ["United Arab Emirates", "AE"],
    ["Nouvelle-Zélande", "NZ"],
    ["U.S.A.", "US"],
    ["UK", "GB"],
    ["Angleterre", "GB"],
    ["Deutschland", "DE"],
    ["Hong Kong", "HK"],
    ["jp", "JP"],
  ])("%j → %s", (text, code) => {
    expect(countryCodeFrom(text)).toBe(code);
  });

  it.each(["", "   ", null, undefined, "non précisé", "Atlantis", "XX", "zz"])(
    "%j → nothing",
    (text) => {
      expect(countryCodeFrom(text)).toBeNull();
    }
  );
});

describe("the rest", () => {
  it("knows which codes a request may be posted to", () => {
    expect(isJobCountry("BE")).toBe(true);
    expect(isJobCountry("US")).toBe(true);
    expect(isJobCountry("be")).toBe(false);
    expect(isJobCountry("XX")).toBe(false);
    expect(isJobCountry(undefined)).toBe(false);
  });

  it("names a country in the reader's language", () => {
    expect(countryName("BE", "fr")).toBe("Belgique");
    expect(countryName("BE", "en")).toBe("Belgium");
  });

  it("names any country, not only the frequent ones", () => {
    expect(countryName("MA", "fr")).toBe("Maroc");
    expect(countryName("JP", "en")).toBe("Japan");
    expect(countryName("RE", "fr")).toBe("La Réunion");
  });

  it("pads the map's bounds around the box", () => {
    const [[west, south], [east, north]] = countryMapBounds("BE")!;
    expect(west).toBeLessThan(2.5);
    expect(east).toBeGreaterThan(6.45);
    expect(south).toBeLessThan(49.45);
    expect(north).toBeGreaterThan(51.55);
  });
});

describe("countryOptions — what the picker lists", () => {
  it("offers the frequent fourteen first, in their own order", () => {
    const { frequent } = countryOptions("fr");
    expect(frequent.map((o) => o.code)).toEqual([...FREQUENT_COUNTRIES]);
    expect(frequent[0].name).toBe("France");
  });

  it("then every country by name, in the reader's language", () => {
    const fr = countryOptions("fr").all;
    expect(fr).toHaveLength(249);
    const names = fr.map((o) => o.name);
    expect(names.indexOf("Allemagne")).toBeLessThan(names.indexOf("Belgique"));
    // Accents sort with their letter, not after « z ».
    expect(names.indexOf("États-Unis")).toBeLessThan(names.indexOf("France"));

    const en = countryOptions("en").all.map((o) => o.name);
    expect(en.indexOf("Germany")).toBeGreaterThan(en.indexOf("Belgium"));
  });
});

describe("geocoderScope — where the map service files a country", () => {
  it("is the country itself for a state", () => {
    expect(geocoderScope("BE", "fr")).toEqual({ countrycodes: "be", suffix: null });
    expect(geocoderScope("US", "fr")).toEqual({ countrycodes: "us", suffix: null });
  });

  it("is the state a territory belongs to, with the territory's name to add", () => {
    expect(geocoderScope("RE", "fr")).toEqual({ countrycodes: "fr", suffix: "La Réunion" });
    expect(geocoderScope("GP", "en")).toEqual({ countrycodes: "fr", suffix: "Guadeloupe" });
    expect(geocoderScope("PR", "en")).toEqual({ countrycodes: "us", suffix: "Puerto Rico" });
  });

  it("names only codes that exist, and never points a territory at itself", () => {
    for (const code of JOB_COUNTRIES) {
      const { countrycodes } = geocoderScope(code, "en");
      expect(isJobCountry(countrycodes.toUpperCase())).toBe(true);
    }
  });
});
