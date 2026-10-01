import { describe, expect, it } from "vitest";

import {
  FIRST_LISTING_REFERENCE,
  parseListingReference,
} from "../listing-reference";

/** listing_reference_spec.md §4 — reading a reference out of a search box. */
describe("parseListingReference", () => {
  it("reads a bare reference", () => {
    expect(parseListingReference("100042")).toBe(100042);
  });

  it.each([
    "Réf. 100042",
    "réf 100042",
    "RÉF.100042",
    "Ref. 100042",
    "ref:100042",
    "ref # 100042",
    "Référence : 100042",
    "reference 100042",
    "REFERENCE-100042",
    "N° 100042",
    "no. 100042",
    "#100042",
  ])("reads %j", (input) => {
    expect(parseListingReference(input)).toBe(100042);
  });

  it("tolerates the spaces people add reading a number back", () => {
    expect(parseListingReference("  100 042 ")).toBe(100042);
    expect(parseListingReference("Réf. 1 000 042")).toBe(1000042);
  });

  it("starts where the sequence starts", () => {
    expect(parseListingReference(String(FIRST_LISTING_REFERENCE))).toBe(
      100001
    );
    expect(parseListingReference("100000")).toBeNull();
  });

  it("stops at the column's integer ceiling", () => {
    expect(parseListingReference("2147483647")).toBe(2147483647);
    expect(parseListingReference("2147483648")).toBeNull();
    expect(parseListingReference("12345678901")).toBeNull();
  });

  it.each(["", "   ", "12345", "canapé", "100042a", "a100042", "Réf.", "10004.2"])(
    "names no reference in %j",
    (input) => {
      expect(parseListingReference(input)).toBeNull();
    }
  );

  it("does not read a reference out of ordinary words that start alike", () => {
    // "no" and "ref" are prefixes only when a number follows them.
    expect(parseListingReference("nord 100042")).toBeNull();
    expect(parseListingReference("refrigerateur")).toBeNull();
  });
});
