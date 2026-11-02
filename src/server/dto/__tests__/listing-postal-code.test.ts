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
const issuesAt = (field: string, postalCode: string, country?: string) => {
  const result = createListingSchema.safeParse({
    dropoff: {
      address: "Place du Roi Baudouin",
      city: "Bruxelles",
      postalCode,
      ...(country && { country }),
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

  it("refuses a country a request cannot be posted to", () => {
    expect(issuesAt("country", "10001", "US")).toEqual(["UNSUPPORTED_COUNTRY"]);
  });
});
