import { describe, it, expect } from "vitest";
import { browseListingsQuerySchema } from "@/server/dto/listings.dto";

const parse = (query: Record<string, string>) =>
  browseListingsQuerySchema.parse(query);

describe("browseListingsQuerySchema", () => {
  it("coerces the corridor's four coordinates", () => {
    const parsed = parse({
      fromLat: "44.84",
      fromLng: "-0.58",
      toLat: "48.86",
      toLng: "2.35",
      radiusKm: "75",
    });

    expect(parsed.fromLat).toBe(44.84);
    expect(parsed.toLng).toBe(2.35);
    expect(parsed.radiusKm).toBe(75);
  });

  it("splits the comma-separated days", () => {
    expect(parse({ days: "2026-09-02,2026-09-05" }).days).toEqual([
      "2026-09-02",
      "2026-09-05",
    ]);
  });

  it("rejects a day that is not a calendar date", () => {
    expect(() => parse({ days: "next tuesday" })).toThrow();
  });

  it("rejects more days than the board will expand", () => {
    // The cap is what bounds the OR the DAL builds.
    const tooMany = Array.from({ length: 32 }, (_, i) =>
      `2026-09-${String(i + 1).padStart(2, "0")}`
    ).join(",");

    expect(() => parse({ days: tooMany })).toThrow();
  });

  it("accepts the three time slots and rejects anything else", () => {
    expect(parse({ slots: "morning,evening" }).slots).toEqual([
      "morning",
      "evening",
    ]);
    expect(() => parse({ slots: "lunchtime" })).toThrow();
  });

  it("defaults the timezone offset to UTC", () => {
    expect(parse({}).tzOffset).toBe(0);
  });

  it("accepts a negative offset, as Europe/Paris reports in summer", () => {
    expect(parse({ tzOffset: "-120" }).tzOffset).toBe(-120);
  });

  it("rejects an offset no timezone has", () => {
    expect(() => parse({ tzOffset: "5000" })).toThrow();
  });

  it("leaves the location filters absent when nothing is passed", () => {
    const parsed = parse({});

    expect(parsed.fromLat).toBeUndefined();
    expect(parsed.days).toBeUndefined();
    expect(parsed.slots).toBeUndefined();
  });
});
