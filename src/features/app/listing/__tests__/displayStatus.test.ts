import { describe, expect, it } from "vitest";

import { displayStatus } from "../statusTone";

/** client_feedback_2026_10_21_spec.md §X1 — display only; the sweep still writes. */
const NOW = new Date("2026-10-24T12:00:00.000Z");

describe("displayStatus", () => {
  it("reads an open request past its deadline as expired", () => {
    expect(displayStatus({ status: "open", expiresAt: "2026-09-27T12:00:00.000Z" }, NOW)).toBe(
      "expired"
    );
  });

  it("leaves an open request inside its deadline open", () => {
    expect(displayStatus({ status: "open", expiresAt: "2026-10-30T00:00:00.000Z" }, NOW)).toBe(
      "open"
    );
  });

  it("never touches any other status", () => {
    expect(displayStatus({ status: "awarded", expiresAt: "2026-09-27T12:00:00.000Z" }, NOW)).toBe(
      "awarded"
    );
    expect(displayStatus({ status: "draft", expiresAt: null }, NOW)).toBe("draft");
  });
});
