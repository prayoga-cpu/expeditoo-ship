import { describe, expect, it } from "vitest";

import {
  CONTACT_POSTAL_CODE_PATTERN,
  POSTAL_CODE_PATTERN,
  formatCompanyNumber,
  isValidCompanyNumber,
  isValidContactPhone,
  isValidContactPostalCode,
  isValidFrenchPhone,
  isValidPlate,
  isValidSiret,
  isValidVat,
  normalizeCompanyNumber,
  normalizeContactPhone,
  normalizeVat,
} from "../french-identifiers";

/**
 * driver_types_spec.md §8 — a professional registered outside France can apply.
 * The strictly French rules are still exported, and still French.
 */

describe("company registration number", () => {
  it.each([
    ["73282932000074", "a SIRET"],
    ["732 829 320 00074", "a SIRET as printed"],
    ["BE 0123.456.789", "a Belgian number"],
    ["HRB 123456", "a German register number"],
    ["12345", "the shortest"],
    ["A".repeat(20), "the longest"],
    ["che-123.456.789", "lower case, dashes and dots"],
  ])("accepts %s (%s)", (value) => {
    expect(isValidCompanyNumber(value)).toBe(true);
  });

  it.each([
    ["", "nothing"],
    ["1234", "four characters"],
    ["A".repeat(21), "twenty-one characters"],
    ["1234/5678", "a slash"],
    ["12345 €", "a symbol"],
  ])("refuses %s (%s)", (value) => {
    expect(isValidCompanyNumber(value)).toBe(false);
  });

  it("stores it without separators, in upper case", () => {
    expect(normalizeCompanyNumber("be 0123.456-789")).toBe("BE0123456789");
    expect(normalizeCompanyNumber("732 829 320 00074")).toBe("73282932000074");
  });

  it("groups a SIRET 3-3-3-5 and leaves anything else as typed", () => {
    expect(formatCompanyNumber("73282932000074")).toBe("732 829 320 00074");
    expect(formatCompanyNumber("732 829 320 00074")).toBe("732 829 320 00074");
    expect(formatCompanyNumber(" BE 0123.456.789 ")).toBe("BE 0123.456.789");
    expect(formatCompanyNumber("7328293200007")).toBe("7328293200007");
    expect(formatCompanyNumber("")).toBe("");
  });

  it("keeps the SIRET rule French: fourteen digits and nothing else", () => {
    expect(isValidSiret("73282932000074")).toBe(true);
    expect(isValidSiret("BE0123456789")).toBe(false);
  });
});

describe("contact phone", () => {
  it.each([
    "0612345678",
    "06 12 34 56 78",
    "06.12.34.56.78",
    "+33612345678",
    "+33 6 12 34 56 78",
    "+32 470 12 34 56",
    "+49 (0151) 234-5678",
    "+41791234567",
    "+12345678",
    "+123456789012345",
  ])("accepts %s", (value) => {
    expect(isValidContactPhone(value)).toBe(true);
  });

  it.each([
    ["", "nothing"],
    ["123", "too short"],
    ["061234567", "nine digits"],
    ["0012345678", "a French number starting 00"],
    ["+1234567", "seven digits after the +"],
    ["+1234567890123456", "sixteen digits after the +"],
    ["32470123456", "international without its +"],
    ["+33 6 12 34 56", "a +33 number that is not a French one"],
    ["+330612345678", "+33 followed by the trunk 0"],
    ["+32 470 AB 34 56", "letters"],
  ])("refuses %s (%s)", (value) => {
    expect(isValidContactPhone(value)).toBe(false);
  });

  it("saves a French number the one way, however it was typed", () => {
    expect(normalizeContactPhone("0612345678")).toBe("+33 6 12 34 56 78");
    expect(normalizeContactPhone("06 12 34 56 78")).toBe("+33 6 12 34 56 78");
    expect(normalizeContactPhone("+33612345678")).toBe("+33 6 12 34 56 78");
    expect(normalizeContactPhone("+33 6 12 34 56 78")).toBe("+33 6 12 34 56 78");
  });

  it("keeps an international number's own prefix", () => {
    expect(normalizeContactPhone("+32 470 12 34 56")).toBe("+32470123456");
    expect(normalizeContactPhone("+49 (0151) 234-5678")).toBe("+4901512345678");
  });

  it("hands back what it cannot read, trimmed, for the validator to refuse", () => {
    expect(normalizeContactPhone("  123 ")).toBe("123");
    expect(normalizeContactPhone("")).toBe("");
  });

  it("keeps the French rule French", () => {
    expect(isValidFrenchPhone("+32470123456")).toBe(false);
  });
});

describe("postal code of a driver's own address", () => {
  it.each(["69000", "1000", "SW1A 1AA", "1012 AB", "4000-123", "D02 X285", "101", "AB12345678"])(
    "accepts %s",
    (value) => {
      expect(isValidContactPostalCode(value)).toBe(true);
      expect(CONTACT_POSTAL_CODE_PATTERN.test(value)).toBe(true);
    }
  );

  it.each([
    ["", "nothing"],
    ["1", "one character"],
    ["12", "two characters"],
    ["12345678901", "eleven characters"],
    ["69 000 ", "a trailing space, untrimmed"],
    ["-6900", "a leading dash"],
    ["69  000", "two spaces together"],
    ["69_000", "an underscore"],
  ])("refuses %s (%s)", (value) => {
    expect(CONTACT_POSTAL_CODE_PATTERN.test(value)).toBe(false);
  });

  it("trims before it judges", () => {
    expect(isValidContactPostalCode(" 69000 ")).toBe(true);
  });

  it("leaves the trajet rule at five digits", () => {
    expect(POSTAL_CODE_PATTERN.test("69000")).toBe(true);
    expect(POSTAL_CODE_PATTERN.test("1000")).toBe(false);
    expect(POSTAL_CODE_PATTERN.test("SW1A 1AA")).toBe(false);
  });
});

describe("VAT number", () => {
  it.each(["FR12345678901", "FRXX123456789", "BE0123456789", "DE123456789", "NL123456789B01", "fr 12 345678901", "IE1234567WA", "XX12"])(
    "accepts %s",
    (value) => {
      expect(isValidVat(value)).toBe(true);
    }
  );

  it.each([
    ["", "nothing"],
    ["FR1", "one character after the country"],
    ["1234567890", "no country letters"],
    ["F123456789", "one country letter"],
    ["FR12345678901234", "fourteen characters after the country"],
    ["FR-123456789", "a dash"],
  ])("refuses %s (%s)", (value) => {
    expect(isValidVat(value)).toBe(false);
  });

  it("stores it without spaces or dots, in upper case", () => {
    expect(normalizeVat("be 0123.456.789")).toBe("BE0123456789");
  });
});

describe("plate", () => {
  it.each(["AB-123-CD", "ab-123-cd", "1234 AB 56", "AB123CD", "1-ABC-123", "B AB 1234", "M-AB 1234", "ABCD", "AB12 CDE", " AB-123-CD "])(
    "accepts %s",
    (value) => {
      expect(isValidPlate(value)).toBe(true);
    }
  );

  it.each([
    ["", "nothing"],
    ["ABC", "three characters"],
    ["ABCDEFGHIJKLM", "thirteen characters"],
    ["AB--123", "two dashes together"],
    ["-AB123", "a leading dash"],
    ["AB.123.CD", "dots"],
    ["AB_123", "an underscore"],
  ])("refuses %s (%s)", (value) => {
    expect(isValidPlate(value)).toBe(false);
  });
});
