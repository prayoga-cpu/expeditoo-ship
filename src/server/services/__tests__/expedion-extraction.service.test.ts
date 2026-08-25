import { describe, expect, it } from "vitest";

import { expedionExtractionService } from "../expedion-extraction.service";

/**
 * `writableFields` is the rule that decides what a re-extraction is allowed to
 * overwrite. It exists because a client corrects the confirm-details screen by
 * hand, and a later re-run of the model must not quietly undo that.
 */

const { writableFields } = expedionExtractionService;

/** A patch shaped like `toQuotePatch`'s output, narrowed to what these tests read. */
const patch = (over: Partial<Record<string, unknown>> = {}) => ({
  firstName: "Jean" as string | null,
  lastName: "DUPONT" as string | null,
  pickupCity: "Lyon" as string | null,
  weightKg: null as number | null,
  ...over,
});

const noName = { firstName: null, lastName: null };
const hasName = { firstName: "Marie", lastName: "MARTIN" };

describe("writableFields", () => {
  it("drops what the model could not read, so a hand-typed value survives", () => {
    const result = writableFields(patch(), hasName);

    expect(result).not.toHaveProperty("weightKg");
    expect(result.pickupCity).toBe("Lyon");
  });

  it("writes the name when the model supplied both halves", () => {
    const result = writableFields(patch(), hasName);

    expect(result.firstName).toBe("Jean");
    expect(result.lastName).toBe("DUPONT");
  });

  it("refuses a half name over a name already on the quote", () => {
    // What a company buyer produces: a surname and no given name. Writing only
    // the surname would leave the client's own first name beside a company's.
    const company = patch({ firstName: null, lastName: "SARL Brocante" });

    const result = writableFields(company, hasName);

    expect(result).not.toHaveProperty("lastName");
    expect(result).not.toHaveProperty("firstName");
  });

  it("accepts a half name when the quote carries no name to contradict", () => {
    const company = patch({ firstName: null, lastName: "SARL Brocante" });

    const result = writableFields(company, noName);

    expect(result.lastName).toBe("SARL Brocante");
    expect(result).not.toHaveProperty("firstName");
  });

  it("treats an empty-string name on the row as no name at all", () => {
    const single = patch({ firstName: null, lastName: "DUPONT" });

    const result = writableFields(single, { firstName: "", lastName: "" });

    expect(result.lastName).toBe("DUPONT");
  });

  it("still writes the other columns when the name pair is refused", () => {
    const company = patch({ firstName: null, lastName: "SARL Brocante" });

    const result = writableFields(company, hasName);

    expect(result.pickupCity).toBe("Lyon");
  });
});
