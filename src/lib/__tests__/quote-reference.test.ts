import { describe, expect, it } from "vitest";

import { formatQuoteReference, parseQuoteReference } from "../quote-reference";

/** client_feedback_2026_10_21_spec.md §A3 — « DEV-04659 ». */
describe("formatQuoteReference", () => {
  it("pads to five digits behind DEV-", () => {
    expect(formatQuoteReference(4659)).toBe("DEV-04659");
    expect(formatQuoteReference(1)).toBe("DEV-00001");
  });

  it("does not truncate a longer number", () => {
    expect(formatQuoteReference(123456)).toBe("DEV-123456");
  });
});

describe("parseQuoteReference", () => {
  it.each(["DEV-04659", "dev-4659", "DEV 04659", " dev4659 "])("reads %j", (input) => {
    expect(parseQuoteReference(input)).toBe(4659);
  });

  it.each(["4659", "11119", "Réf. 100042", "DEV-", "DEV-0"])("does not read %j", (input) => {
    expect(parseQuoteReference(input)).toBeNull();
  });
});
