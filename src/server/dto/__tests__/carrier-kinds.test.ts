import { describe, expect, it } from "vitest";

import { createDriverSchema, upsertCarrierSchema } from "../carrier.dto";

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
