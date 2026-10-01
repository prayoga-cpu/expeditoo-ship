import { describe, expect, it } from "vitest";

import { isRedundantService } from "../cargo-packaging";

/**
 * The whole table from cargo_packaging_services_spec.md §2. The form and the
 * create DTO both decide from this, so a wrong cell here is a request the form
 * builds and the API refuses, or a contradiction both let through.
 */
describe("isRedundantService", () => {
  it.each([
    [null, "needsProtection", false],
    [null, "needsPackaging", false],
    [undefined, "needsProtection", false],
    [undefined, "needsPackaging", false],
    // Wrapped already, so wrapping it again is the redundant ask...
    ["protected", "needsProtection", true],
    // ...but a wrapped item may still need a box.
    ["protected", "needsPackaging", false],
    // Boxed means protected, then put in a box: it covers both.
    ["boxed", "needsProtection", true],
    ["boxed", "needsPackaging", true],
  ] as const)("%s covers %s: %s", (level, service, expected) => {
    expect(isRedundantService(level, service)).toBe(expected);
  });
});
