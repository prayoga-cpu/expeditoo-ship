import { describe, it, expect } from "vitest";
import { adminListingsQuerySchema } from "@/server/dto/listings.dto";

const parse = (query: Record<string, string>) =>
  adminListingsQuerySchema.parse(query);

describe("adminListingsQuerySchema", () => {
  it("accepts either inlet", () => {
    expect(parse({ origin: "direct" }).origin).toBe("direct");
    expect(parse({ origin: "expedion" }).origin).toBe("expedion");
  });

  it("leaves origin unset when absent, which means both inlets", () => {
    const parsed = parse({});

    expect(parsed.origin).toBeUndefined();
    expect(parsed).toMatchObject({ page: 1, limit: 50 });
  });

  it("rejects an origin that is not an inlet", () => {
    expect(() => parse({ origin: "airtable" })).toThrow();
    expect(() => parse({ origin: "" })).toThrow();
  });

  it("combines origin with status and coerces the paging", () => {
    expect(
      parse({ origin: "direct", status: "open", page: "2", limit: "5" })
    ).toEqual({
      origin: "direct",
      status: "open",
      posted: false,
      page: 2,
      limit: 5,
    });
  });

  it("reads posted as a flag, off unless it says true", () => {
    expect(parse({ posted: "true" }).posted).toBe(true);
    expect(parse({ posted: "false" }).posted).toBe(false);
    expect(parse({}).posted).toBe(false);
    // `z.coerce.boolean` would read "false" as true; anything else is refused.
    expect(() => parse({ posted: "1" })).toThrow();
  });
});
