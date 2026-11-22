import { describe, expect, it } from "vitest";

import {
  JOB_POSTAL_CODE_PATTERN,
  normaliseJobPostalCode,
  quoteDeliveryCountry,
  quotePostalCodeFor,
} from "../postal-code";

/**
 * The client typed 1000 BRUXELLES and was told a postal code "must be 5
 * digits" (postal_codes_abroad_spec.md). These pin the countries Expedion
 * actually delivers to.
 */
describe("JOB_POSTAL_CODE_PATTERN", () => {
  it.each([
    ["1000", "Brussels"],
    ["1010", "Vienna"],
    ["75011", "Paris"],
    ["010011", "Bucharest"],
  ])("accepts %s (%s)", (code) => {
    expect(JOB_POSTAL_CODE_PATTERN.test(code)).toBe(true);
  });

  it.each(["123", "1234567", "75 011", "AB123", "", "L-1234"])(
    "refuses %j as typed",
    (code) => {
      expect(JOB_POSTAL_CODE_PATTERN.test(code)).toBe(false);
    }
  );
});

describe("normaliseJobPostalCode", () => {
  it("keeps the digits of a code with separators", () => {
    expect(normaliseJobPostalCode("L-1234")).toBe("1234");
    expect(normaliseJobPostalCode("010 011")).toBe("010011");
    expect(normaliseJobPostalCode(" 69003 ")).toBe("69003");
  });

  it("keeps a Dutch code's area digits", () => {
    expect(normaliseJobPostalCode("1012 AB")).toBe("1012");
  });

  it("refuses what is too short or too long once stripped", () => {
    expect(normaliseJobPostalCode("SW1A 1AA")).toBeNull();
    expect(normaliseJobPostalCode("123")).toBeNull();
    expect(normaliseJobPostalCode("1000-001")).toBeNull();
  });

  it("treats nothing as nothing", () => {
    expect(normaliseJobPostalCode(null)).toBeNull();
    expect(normaliseJobPostalCode(undefined)).toBeNull();
    expect(normaliseJobPostalCode("")).toBeNull();
  });
});

// 2.95.0 — an escalated quote's delivery code follows the delivery country,
// with the listing's own two tiers (postal_codes_abroad_spec.md §8).
describe("quotePostalCodeFor", () => {
  it.each([
    ["FR", "75001", "75001"],
    ["BE", "1000", "1000"],
    ["LU", "L-1234", "1234"],
    ["RO", "010 011", "010011"],
  ])("keeps the strict digits rule in %s: %j → %j", (country, typed, stored) => {
    expect(quotePostalCodeFor(country, typed)).toBe(stored);
  });

  it.each([
    ["FR", null],
    ["FR", ""],
    ["FR", "SW1A 1AA"],
    ["DE", "123"],
    // No country at all is France, as everywhere else.
    [null, null],
    [undefined, "12"],
  ])("refuses %j with %j", (country, typed) => {
    expect(quotePostalCodeFor(country, typed)).toBeNull();
  });

  it.each([
    ["GB", " SW1A 1AA ", "SW1A 1AA"],
    ["US", "10001", "10001"],
    ["CA", "K1A 0B1", "K1A 0B1"],
    ["JP", "100-0001", "100-0001"],
  ])("keeps a code as written outside the detailed countries: %s %j", (country, typed, stored) => {
    expect(quotePostalCodeFor(country, typed)).toBe(stored);
  });

  it.each([null, undefined, "", "   "])(
    "stores '' where the country may have no postal code (%j)",
    (typed) => {
      expect(quotePostalCodeFor("HK", typed)).toBe("");
    }
  );

  it("still refuses what is not shaped like a postal code", () => {
    expect(quotePostalCodeFor("GB", "see the note on the door")).toBeNull();
    expect(quotePostalCodeFor("US", "#")).toBeNull();
  });
});

describe("quoteDeliveryCountry", () => {
  it.each([
    ["Royaume-Uni", "GB"],
    ["Belgique", "BE"],
    ["", "FR"],
    [null, "FR"],
    ["non précisé", "FR"],
  ])("reads %j as %s", (text, code) => {
    expect(quoteDeliveryCountry(text)).toBe(code);
  });
});
