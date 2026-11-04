import { describe, expect, it } from "vitest";
import { ApiError, isRefusal } from "../fetcher";

describe("isRefusal", () => {
  it.each([401, 403, 404])("treats a %s as an answer that will not change", (status) => {
    expect(isRefusal(new ApiError("X", "x", status))).toBe(true);
  });

  it.each([400, 409, 500, 503])("leaves a %s to be retried or reported", (status) => {
    expect(isRefusal(new ApiError("X", "x", status))).toBe(false);
  });

  it("never mistakes a dropped connection for a refusal", () => {
    expect(isRefusal(new TypeError("Failed to fetch"))).toBe(false);
  });
});
