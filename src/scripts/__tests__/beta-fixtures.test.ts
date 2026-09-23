import { describe, expect, it } from "vitest";
import {
  IDS,
  LISTINGS,
  OWNER_SIRET,
  PLACES,
  QA_SIRET,
  TITLE_PREFIX,
  expedionListingRow,
  expedionQuoteRow,
  isValidSiret,
  listingInput,
  offerInput,
  placeholderPhoto,
  routeInputs,
  utcAt,
} from "../beta-fixtures";

const NOW = new Date("2026-09-23T12:00:00Z");

describe("SIRET fixtures", () => {
  it("both seeded SIRETs pass the Luhn check the form applies", () => {
    expect(isValidSiret(OWNER_SIRET)).toBe(true);
    expect(isValidSiret(QA_SIRET)).toBe(true);
  });

  it("a single-digit change fails it", () => {
    const tampered = OWNER_SIRET.slice(0, -1) + ((Number(OWNER_SIRET.at(-1)) + 1) % 10);
    expect(isValidSiret(tampered)).toBe(false);
    expect(isValidSiret("1234")).toBe(false);
  });
});

describe("listing fixtures", () => {
  it.each(Object.entries(LISTINGS))("%s parses through createListingSchema", (_key, spec) => {
    const input = listingInput(spec, NOW);
    expect(input.title.startsWith(TITLE_PREFIX)).toBe(true);
    expect(input.publish).toBe(spec.publish);
    expect(input.pickupFrom < input.pickupUntil).toBe(true);
    expect(input.pickupUntil < input.dropoffFrom).toBe(true);
    expect(input.dropoffFrom < input.dropoffUntil).toBe(true);
    expect(input.pickupFrom > NOW).toBe(true);
  });

  it("carries coordinates on both ends, which the award requires", () => {
    const input = listingInput(LISTINGS.completed, NOW);
    expect(input.pickup.lat).toBe(PLACES.drouot.lat);
    expect(input.dropoff.lng).toBe(PLACES.lyon.lng);
  });
});

describe("offer fixture", () => {
  it("proposes one morning slot on the job's own pickup day", () => {
    const pickupFrom = utcAt(3, 7, NOW);
    const input = offerInput(pickupFrom, "veh_1", 23_500, "ok");
    expect(input.slots).toEqual([{ day: "2026-09-26", slot: "morning" }]);
    expect(input.deliveryLeadDays).toBe(1);
    expect(input.priceCents).toBe(23_500);
  });
});

describe("route fixtures", () => {
  it("owner is recurring with weekdays and no dates; qa is occasional with dates and no weekdays", () => {
    const { owner, qa } = routeInputs("veh_owner", "veh_qa", NOW);
    expect(owner.kind).toBe("recurring");
    expect(owner.daysOfWeek).toEqual([1, 3, 5]);
    expect(owner.dates).toBeUndefined();
    expect(qa.kind).toBe("occasional");
    expect(qa.dates).toHaveLength(2);
    expect(qa.daysOfWeek).toBeUndefined();
    expect(owner.vehicleId).toBe("veh_owner");
    expect(qa.vehicleId).toBe("veh_qa");
  });
});

describe("Expedion award-queue fixtures", () => {
  it("the listing is an escalated Expedion job keyed to the quote", () => {
    const quote = expedionQuoteRow(NOW);
    const row = expedionListingRow("lst_1", "sys_1", "cat_1", quote, NOW);
    expect(quote.id).toBe(IDS.expedionQuote);
    expect(quote.status).toBe("escalated");
    expect(row.origin).toBe("expedion");
    expect(row.externalRef).toBe(quote.id);
    expect(row.shipperId).toBe("sys_1");
    expect(row.expiresAt.getTime()).toBe(row.pickupFrom.getTime() - 6 * 60 * 60 * 1000);
  });
});

describe("placeholder photo", () => {
  it("is recognisable by its key so it can be retired again", () => {
    const row = placeholderPhoto("shp_1", "pickup", PLACES.drouot, "usr_1", NOW);
    expect(row.objectKey.startsWith("beta/")).toBe(true);
    expect(row.id).toBe("beta_photo_pickup_shp_1");
    expect(row.stage).toBe("pickup");
  });
});
