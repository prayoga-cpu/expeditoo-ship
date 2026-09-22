import { describe, expect, it } from "vitest";

import { jobFormSchema } from "../schemas";

/**
 * The client mirror exists so the form can validate per step without a round
 * trip, which only helps if it agrees with `listings.dto.ts`. These tests cover
 * the rules the old mirror left out — France bounds and the minimum route —
 * because those were the two that let the form submit work the API then
 * rejected with a code the form had no message for.
 */

const LYON = { lat: 45.75, lng: 4.85, address: "12 rue A", city: "Lyon" };
const MARSEILLE = { lat: 43.3, lng: 5.37, address: "3 rue B", city: "Marseille" };

const iso = (offsetHours: number) => {
  const d = new Date(Date.now() + offsetHours * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

const endpoint = (over: Record<string, unknown> = {}) => ({
  ...LYON,
  postalCode: "69003",
  locationType: "house",
  contactPhone: "0612345678",
  ...over,
});

const form = (over: Record<string, unknown> = {}) => ({
  title: "Two-seater sofa and a table",
  description: "A sofa and a coffee table, ground floor at both ends please.",
  weightBracket: "upTo100",
  quantity: "1",
  isFragile: false,
  needsHelp: false,
  isFlexible: false,
  photos: [],
  pickup: endpoint(),
  dropoff: endpoint({ ...MARSEILLE, postalCode: "13001" }),
  pickupFrom: iso(48),
  pickupUntil: iso(56),
  dropoffFrom: iso(72),
  dropoffUntil: iso(80),
  budgetEuros: "250",
  ...over,
});

/** Every message this schema raises, flattened, so a test can look one up. */
const messages = (input: unknown): string[] => {
  const result = jobFormSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("jobFormSchema", () => {
  it("accepts a complete Lyon → Marseille request", () => {
    expect(jobFormSchema.safeParse(form()).success).toBe(true);
  });

  it("rejects a pickup outside France", () => {
    // Berlin. The server answers LOCATION_OUT_OF_COUNTRY; the form should have
    // said so before the round trip.
    const berlin = endpoint({ lat: 52.52, lng: 13.4, city: "Berlin" });

    expect(messages(form({ pickup: berlin }))).toContain(
      "create.validation.outsideFrance"
    );
  });

  it("rejects a delivery outside France", () => {
    const london = endpoint({ lat: 51.5, lng: -0.12, city: "London" });

    expect(messages(form({ dropoff: london }))).toContain(
      "create.validation.outsideFrance"
    );
  });

  it("rejects two points closer than the minimum route", () => {
    // Roughly 40 m apart — a job nobody would drive.
    const nextDoor = endpoint({ lat: 45.7504, lng: 4.85, postalCode: "69003" });

    expect(messages(form({ dropoff: nextDoor }))).toContain(
      "create.validation.tooClose"
    );
  });

  it("wants all three dimensions or none, in exact mode", () => {
    expect(
      messages(form({ sizeMode: "exact", lengthCm: "120" }))
    ).toContain("create.validation.dimensionsPartial");
    expect(
      jobFormSchema.safeParse(
        form({ sizeMode: "exact", lengthCm: "120", widthCm: "80", heightCm: "70" })
      ).success
    ).toBe(true);
  });

  it("ignores a stale dimension left behind under a size preset", () => {
    // The three fields are off screen in `preset` mode. A value one of them
    // still holds is not the answer the person gave, so it cannot fail a
    // submit — `resolveDimensions` will not send it either.
    expect(
      jobFormSchema.safeParse(
        form({ sizeMode: "preset", sizePreset: "l", lengthCm: "120" })
      ).success
    ).toBe(true);
  });

  it("treats an emptied dimension as absent, not as zero", () => {
    // `z.coerce.number()` reads "" as 0, which passed `.min(0)` and failed
    // `.positive()` complaining about zero — neither of which is what the
    // person did. Blank must mean "not given".
    const parsed = jobFormSchema.safeParse(
      form({ sizeMode: "exact", lengthCm: "", widthCm: "", heightCm: "" })
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.lengthCm).toBeUndefined();
  });

  it("requires a weight bracket", () => {
    expect(messages(form({ weightBracket: undefined }))).toContain(
      "create.validation.weightRequired"
    );
  });

  it("accepts a bracket with no size at all", () => {
    const parsed = jobFormSchema.safeParse(
      form({ weightBracket: "upTo5", sizePreset: undefined })
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.sizePreset).toBeUndefined();
  });

  it("makes the freight bracket state a figure", () => {
    expect(messages(form({ weightBracket: "over1000" }))).toContain(
      "create.validation.weightRequired"
    );
  });

  it("rejects a freight figure that is not above the bracket it sits in", () => {
    expect(
      messages(form({ weightBracket: "over1000", exactWeightKg: "900" }))
    ).toContain("create.validation.weightAboveBracket");
  });

  it("accepts a freight figure above one tonne", () => {
    expect(
      jobFormSchema.safeParse(
        form({ weightBracket: "over1000", exactWeightKg: "12000" })
      ).success
    ).toBe(true);
  });

  it("still refuses more than the 44 t the DTO allows", () => {
    expect(
      messages(form({ weightBracket: "over1000", exactWeightKg: "50000" }))
    ).toContain("create.validation.weightMax");
  });

  it("makes an apartment declare its floor and lift", () => {
    const flat = endpoint({ locationType: "apartment" });
    const raised = messages(form({ pickup: flat }));

    expect(raised).toContain("create.validation.floorRequired");
    expect(raised).toContain("create.validation.liftRequired");
  });

  it("accepts an apartment that declares both", () => {
    const flat = endpoint({ locationType: "apartment", floor: "3", hasLift: true });

    expect(jobFormSchema.safeParse(form({ pickup: flat })).success).toBe(true);
  });

  it("rejects a pickup window that ends before it starts", () => {
    expect(
      messages(form({ pickupFrom: iso(56), pickupUntil: iso(48) }))
    ).toContain("create.validation.pickupWindow");
  });

  it("rejects a delivery that starts before the pickup", () => {
    expect(
      messages(form({ dropoffFrom: iso(24), dropoffUntil: iso(30) }))
    ).toContain("create.validation.deliveryBeforePickup");
  });

  it("parses the datetime-local strings the form actually submits", () => {
    const parsed = jobFormSchema.safeParse(form());

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.pickupFrom).toBeInstanceOf(Date);
  });

  it("accepts a short description, five characters or more", () => {
    expect(
      jobFormSchema.safeParse(form({ description: "A box" })).success
    ).toBe(true);
  });

  it("still rejects a description under five characters", () => {
    expect(messages(form({ description: "Hi" }))).toContain(
      "create.validation.descriptionShort"
    );
  });

  it("accepts the 'I'm not sure' weight bracket", () => {
    expect(
      jobFormSchema.safeParse(form({ weightBracket: "notSure" })).success
    ).toBe(true);
  });

  it("accepts a fragile note", () => {
    const parsed = jobFormSchema.safeParse(
      form({ isFragile: true, fragileNote: "Glass top, keep upright" })
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.fragileNote).toBe(
      "Glass top, keep upright"
    );
  });

  it("rejects a fragile note over 300 characters", () => {
    expect(
      messages(form({ isFragile: true, fragileNote: "x".repeat(301) }))
    ).toContain("create.validation.fragileNoteMax");
  });

  it("requires a contact phone at pickup and dropoff", () => {
    expect(
      messages(form({ pickup: endpoint({ contactPhone: "" }) }))
    ).toContain("create.validation.invalidPhone");
  });

  it("rejects a contact phone that is not a real French number", () => {
    expect(
      messages(form({ pickup: endpoint({ contactPhone: "not-a-phone" }) }))
    ).toContain("create.validation.invalidPhone");
  });

  it("accepts a contact phone with spacing, and one in +33 form", () => {
    expect(
      jobFormSchema.safeParse(
        form({ pickup: endpoint({ contactPhone: "06 12 34 56 78" }) })
      ).success
    ).toBe(true);
    expect(
      jobFormSchema.safeParse(
        form({
          dropoff: endpoint({
            ...MARSEILLE,
            postalCode: "13001",
            contactPhone: "+33612345678",
          }),
        })
      ).success
    ).toBe(true);
  });

  it("leaves the carrier note and contact name optional", () => {
    expect(jobFormSchema.safeParse(form()).success).toBe(true);
  });

  it("accepts a carrier note with access instructions", () => {
    const parsed = jobFormSchema.safeParse(
      form({
        pickup: endpoint({
          note: "Second floor, past the red door",
          contactName: "Marie",
        }),
      })
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pickup.note).toBe("Second floor, past the red door");
      expect(parsed.data.pickup.contactName).toBe("Marie");
    }
  });

  it("rejects a carrier note over 300 characters", () => {
    expect(
      messages(form({ pickup: endpoint({ note: "x".repeat(301) }) }))
    ).toContain("create.validation.noteMax");
  });

  it("rejects a contact name over 120 characters", () => {
    expect(
      messages(form({ pickup: endpoint({ contactName: "x".repeat(121) }) }))
    ).toContain("create.validation.contactNameMax");
  });
});
