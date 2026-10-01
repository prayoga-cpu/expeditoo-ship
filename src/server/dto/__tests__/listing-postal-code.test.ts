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
const postalIssues = (postalCode: string) => {
  const result = createListingSchema.safeParse({
    dropoff: {
      address: "Place du Roi Baudouin",
      city: "Bruxelles",
      postalCode,
      locationType: "house",
    },
  });
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path.join(".") === "dropoff.postalCode")
    .map((issue) => issue.message);
};

describe("createListingSchema — postal codes", () => {
  it.each(["1000", "75011", "010011"])("accepts %s", (code) => {
    expect(postalIssues(code)).toEqual([]);
  });

  it.each(["123", "1234567", "75 011", "AB123"])("refuses %j", (code) => {
    expect(postalIssues(code)).toEqual(["INVALID_POSTAL_CODE"]);
  });
});
