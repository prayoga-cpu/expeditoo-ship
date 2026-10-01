import { describe, expect, it } from "vitest";

import {
  MATERIAL_FIELDS,
  createListingSchema,
  updateListingSchema,
} from "@/server/dto/listings.dto";

/**
 * cargo_packaging_services_spec.md §2 and §4: the two services a requester can
 * ask of the carrier, and the contradictions the create contract refuses.
 */

const endpoint = (over: Record<string, unknown> = {}) => ({
  lat: 45.75,
  lng: 4.85,
  address: "12 rue A",
  city: "Lyon",
  postalCode: "69003",
  locationType: "house",
  ...over,
});

const payload = (over: Record<string, unknown> = {}) => ({
  title: "Two-seater sofa",
  description: "A sofa and a coffee table, ground floor at both ends.",
  weightKg: 80,
  pickup: endpoint(),
  dropoff: endpoint({ lat: 43.3, lng: 5.37, city: "Marseille", postalCode: "13001" }),
  pickupFrom: "2026-10-05T08:00:00.000Z",
  pickupUntil: "2026-10-05T16:00:00.000Z",
  dropoffFrom: "2026-10-06T08:00:00.000Z",
  dropoffUntil: "2026-10-06T16:00:00.000Z",
  budgetCents: 25_000,
  ...over,
});

const messages = (input: unknown): string[] => {
  const result = createListingSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("createListingSchema packaging services", () => {
  it("asks for neither service when the request says nothing", () => {
    const parsed = createListingSchema.parse(payload());

    expect(parsed.needsProtection).toBe(false);
    expect(parsed.needsPackaging).toBe(false);
  });

  it("takes both services at once", () => {
    const parsed = createListingSchema.parse(
      payload({ needsProtection: true, needsPackaging: true })
    );

    expect(parsed.needsProtection).toBe(true);
    expect(parsed.needsPackaging).toBe(true);
  });

  it("lets a wrapped item still ask for a box", () => {
    expect(
      messages(payload({ packagingLevel: "protected", needsPackaging: true }))
    ).toEqual([]);
  });

  it.each([
    ["protected", "needsProtection"],
    ["boxed", "needsProtection"],
    ["boxed", "needsPackaging"],
  ])("refuses %s beside %s", (packagingLevel, service) => {
    expect(messages(payload({ packagingLevel, [service]: true }))).toEqual([
      "PACKAGING_CONTRADICTION",
    ]);
  });
});

describe("updateListingSchema packaging services", () => {
  it("leaves both services untouched when a patch does not name them", () => {
    // A partial must not default them to false: that would switch off a
    // service on every unrelated edit, and invalidate every live offer with it.
    const parsed = updateListingSchema.parse({ description: "Clarified access" });

    expect(parsed).not.toHaveProperty("needsProtection");
    expect(parsed).not.toHaveProperty("needsPackaging");
  });
});

describe("MATERIAL_FIELDS", () => {
  it("counts both services as something a carrier priced", () => {
    expect(MATERIAL_FIELDS).toContain("needsProtection");
    expect(MATERIAL_FIELDS).toContain("needsPackaging");
  });
});
