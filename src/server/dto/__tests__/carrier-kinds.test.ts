import { describe, expect, it } from "vitest";

import { createDriverSchema, createVehicleSchema, upsertCarrierSchema } from "../carrier.dto";

/** driver_types_spec.md §3–§4. */

const contact = {
  contactPhone: "0612345678",
  addressLine: "12 rue Exemple",
  city: "Lyon",
  postalCode: "69000",
};

const company = {
  companyName: "Jane Transport",
  siret: "732 829 320 00074",
};

describe("upsertCarrierSchema", () => {
  it("reads a body with no kind as a professional application", () => {
    const parsed = upsertCarrierSchema.parse({ ...company, ...contact });

    expect(parsed.kind).toBe("professional");
    expect(parsed).toMatchObject({ companyName: "Jane Transport", siret: "73282932000074" });
  });

  it("still requires the company and a SIRET of a professional", () => {
    expect(() => upsertCarrierSchema.parse({ kind: "professional", ...contact })).toThrow();
    expect(() =>
      upsertCarrierSchema.parse({ kind: "professional", ...company, siret: "123", ...contact })
    ).toThrow();
  });

  it("takes an in-house driver with nothing but how to reach them", () => {
    const parsed = upsertCarrierSchema.parse({ kind: "private", ...contact });

    expect(parsed.kind).toBe("private");
    expect(parsed).not.toHaveProperty("siret");
  });

  it("still validates the phone and the postcode of an in-house driver", () => {
    expect(() =>
      upsertCarrierSchema.parse({ kind: "private", ...contact, contactPhone: "123" })
    ).toThrow();
    expect(() =>
      upsertCarrierSchema.parse({ kind: "private", ...contact, postalCode: "1" })
    ).toThrow();
  });

  it("refuses a kind it does not know", () => {
    expect(() => upsertCarrierSchema.parse({ kind: "company", ...contact })).toThrow();
  });
});

describe("createDriverSchema", () => {
  const vehicle = { type: "van", maxWeightKg: 1200, plateNumber: "AB-123-CD" };

  it("needs a name to invite someone", () => {
    expect(() =>
      createDriverSchema.parse({ mode: "invite", email: "a@b.fr", ...contact, vehicle })
    ).toThrow();
    expect(
      createDriverSchema.parse({ mode: "invite", name: "Jane Driver", email: "a@b.fr", ...contact, vehicle })
        .mode
    ).toBe("invite");
  });

  it("converts a registered account without a name", () => {
    const parsed = createDriverSchema.parse({ mode: "existing", email: "a@b.fr", ...contact, vehicle });

    expect(parsed.mode).toBe("existing");
    expect(parsed.name).toBeUndefined();
  });

  it("asks for no company, SIRET or legal form", () => {
    const parsed = createDriverSchema.parse({
      mode: "existing",
      email: "a@b.fr",
      ...contact,
      vehicle,
      companyName: "ignored",
      siret: "ignored",
    });

    expect(parsed).not.toHaveProperty("companyName");
    expect(parsed).not.toHaveProperty("siret");
  });

  it("refuses a mode that is neither", () => {
    expect(() =>
      createDriverSchema.parse({ mode: "convert", email: "a@b.fr", ...contact, vehicle })
    ).toThrow();
  });
});

/** driver_types_spec.md §8 — a professional registered outside France. */
describe("formats outside France", () => {
  const belgian = {
    kind: "professional" as const,
    companyName: "Transports Peeters SRL",
    siret: "BE 0123.456.789",
    vatNumber: "be 0123 456 789",
    contactPhone: "+32 470 12 34 56",
    addressLine: "Rue de la Loi 16",
    city: "Bruxelles",
    postalCode: "1000",
  };

  it("takes a foreign company number, VAT, phone and postal code", () => {
    const parsed = upsertCarrierSchema.parse(belgian);

    expect(parsed).toMatchObject({
      kind: "professional",
      siret: "BE0123456789",
      vatNumber: "BE0123456789",
      contactPhone: "+32 470 12 34 56",
      postalCode: "1000",
    });
  });

  it("still stores a SIRET as its fourteen digits", () => {
    const parsed = upsertCarrierSchema.parse({ ...belgian, siret: "732 829 320 00074" });

    expect(parsed).toMatchObject({ siret: "73282932000074" });
  });

  it.each([
    ["siret", "1234"],
    ["siret", "A".repeat(21)],
    ["vatNumber", "0123456789"],
    ["vatNumber", ""],
    ["contactPhone", "32470123456"],
    ["contactPhone", "+1234567"],
    ["postalCode", "12"],
    ["postalCode", "12345678901"],
  ])("refuses a professional whose %s is « %s »", (field, value) => {
    expect(upsertCarrierSchema.safeParse({ ...belgian, [field]: value }).success).toBe(false);
  });

  it("names the refusal by the codes the clients already read", () => {
    const result = upsertCarrierSchema.safeParse({
      ...belgian,
      siret: "1",
      vatNumber: "1",
      contactPhone: "1",
      postalCode: "1",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).sort()).toEqual([
      "INVALID_PHONE",
      "INVALID_POSTAL_CODE",
      "INVALID_SIRET",
      "INVALID_VAT",
    ]);
  });

  it("gives an in-house driver the same phone and postal rules", () => {
    const parsed = upsertCarrierSchema.parse({
      kind: "private",
      contactPhone: "+41 79 123 45 67",
      addressLine: "Rue du Rhône 1",
      city: "Genève",
      postalCode: " 1204 ",
    });

    expect(parsed).toMatchObject({ kind: "private", postalCode: "1204" });
  });

  it.each(["1-ABC-123", "B AB 1234", "ab-123-cd", "1234 AB 56"])(
    "takes the plate « %s » on a vehicle",
    (plateNumber) => {
      expect(
        createVehicleSchema.safeParse({ type: "van", maxWeightKg: 1200, plateNumber }).success
      ).toBe(true);
    }
  );

  it.each(["ABC", "ABCDEFGHIJKLM", "AB.123.CD", ""])(
    "refuses the plate « %s »",
    (plateNumber) => {
      const result = createVehicleSchema.safeParse({ type: "van", maxWeightKg: 1200, plateNumber });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("INVALID_PLATE");
    }
  );

  it("takes a foreign phone, postal code and plate when an admin adds a driver", () => {
    const parsed = createDriverSchema.safeParse({
      mode: "existing",
      email: "a@b.be",
      contactPhone: "+32 470 12 34 56",
      addressLine: "Rue de la Loi 16",
      city: "Bruxelles",
      postalCode: "1000",
      vehicle: { type: "van", maxWeightKg: 1200, plateNumber: "1-ABC-123" },
    });

    expect(parsed.success).toBe(true);
  });
});
