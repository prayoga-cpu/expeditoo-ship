import { describe, expect, it } from "vitest";

import { JOB_POSTAL_CODE_PATTERN, normaliseJobPostalCode } from "../postal-code";

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
