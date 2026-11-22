import { describe, expect, it } from "vitest";

import { createListingSchema } from "../listings.dto";

/**
 * The server half of postal_codes_abroad_spec.md. The form mirror is tested in
 * `create/__tests__/schemas.test.ts`; this pins that the API agrees, because a
 * form that passes a code the API refuses posts nothing.
 *
 * Only the postal code's own issues are read, so the test does not depend on
 * the rest of a listing payload staying valid as the DTO grows.
 */
const issuesAt = (
  field: string,
  postalCode: string,
  country?: string,
  pin?: { lat: number; lng: number }
) => {
  const result = createListingSchema.safeParse({
    dropoff: {
      address: "Place du Roi Baudouin",
      city: "Bruxelles",
      postalCode,
      ...(country && { country }),
      ...pin,
      locationType: "house",
    },
  });
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path.join(".") === `dropoff.${field}`)
    .map((issue) => issue.message);
};

const postalIssues = (postalCode: string, country?: string) =>
  issuesAt("postalCode", postalCode, country);

/**
 * Since 2.76.0 the code is read in the end's own country
 * (client_feedback_2026_10_31_spec.md §6.3); absent means France.
 */
describe("createListingSchema — postal codes", () => {
  it.each([
    ["75011", undefined],
    ["75011", "FR"],
    ["1000", "BE"],
    ["010011", "RO"],
    ["1012 AB", "NL"],
    ["1100-148", "PT"],
    ["00-950", "PL"],
  ])("accepts %s in %s", (code, country) => {
    expect(postalIssues(code, country)).toEqual([]);
  });

  it.each([
    ["123", undefined],
    ["1234567", undefined],
    ["75 011", undefined],
    ["AB123", undefined],
    ["1000", "FR"],
    ["75011", "BE"],
  ])("refuses %j in %s", (code, country) => {
    expect(postalIssues(code, country)).toEqual(["INVALID_POSTAL_CODE"]);
  });

  it("requires one where the country's format is known", () => {
    expect(postalIssues("")).toEqual(["INVALID_POSTAL_CODE"]);
    expect(postalIssues("   ", "FR")).toEqual(["INVALID_POSTAL_CODE"]);
    expect(postalIssues("", "BE")).toEqual(["INVALID_POSTAL_CODE"]);
  });
});

/**
 * Since 2.94.0 a request can be anywhere (postal_codes_abroad_spec.md §5): the
 * fourteen detailed countries above keep their rule, every other country and
 * territory takes a postal code of any usual shape, or none.
 */
describe("createListingSchema — every other country", () => {
  it.each([
    ["10001", "US"],
    ["SW1A 1AA", "GB"],
    ["K1A 0B1", "CA"],
    ["100-0001", "JP"],
    ["20250", "MA"],
    ["97400", "RE"],
    ["", "AE"],
    ["   ", "HK"],
    ["", "SN"],
  ])("accepts %j in %s", (code, country) => {
    expect(postalIssues(code, country)).toEqual([]);
    expect(issuesAt("country", code, country)).toEqual([]);
  });

  it.each([
    ["1", "US"],
    ["1234567890123", "US"],
    ["10001!", "US"],
  ])("refuses %j in %s", (code, country) => {
    expect(postalIssues(code, country)).toContain("INVALID_POSTAL_CODE");
  });

  it("is not held to France's five digits", () => {
    expect(postalIssues("1000", "US")).toEqual([]);
  });

  it("refuses a code nobody assigned, and a name where a code belongs", () => {
    expect(issuesAt("country", "10001", "XX")).toEqual(["UNSUPPORTED_COUNTRY"]);
    expect(issuesAt("country", "10001", "us")).toContain("UNSUPPORTED_COUNTRY");
    expect(issuesAt("country", "10001", "Maroc")).toContain("UNSUPPORTED_COUNTRY");
  });

  it("has no box to refuse a pin with — a detailed country still has", () => {
    const tokyo = { lat: 35.68, lng: 139.69 };
    expect(issuesAt("lat", "100-0001", "JP", tokyo)).toEqual([]);
    expect(issuesAt("lat", "75011", "FR", tokyo)).toEqual(["LOCATION_OUT_OF_COUNTRY"]);
    expect(issuesAt("lat", "75011", undefined, tokyo)).toEqual(["LOCATION_OUT_OF_COUNTRY"]);
  });
});
