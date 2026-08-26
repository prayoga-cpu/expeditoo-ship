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
  ...over,
});

const form = (over: Record<string, unknown> = {}) => ({
  title: "Two-seater sofa and a table",
  description: "A sofa and a coffee table, ground floor at both ends please.",
  weightKg: "80",
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

  it("wants all three dimensions or none", () => {
    expect(messages(form({ lengthCm: "120" }))).toContain(
      "create.validation.dimensionsPartial"
    );
    expect(
      jobFormSchema.safeParse(
        form({ lengthCm: "120", widthCm: "80", heightCm: "70" })
      ).success
    ).toBe(true);
  });

  it("treats an emptied dimension as absent, not as zero", () => {
    // `z.coerce.number()` reads "" as 0, which passed `.min(0)` and failed
    // `.positive()` complaining about zero — neither of which is what the
    // person did. Blank must mean "not given".
    const parsed = jobFormSchema.safeParse(
      form({ lengthCm: "", widthCm: "", heightCm: "" })
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.lengthCm).toBeUndefined();
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
});
