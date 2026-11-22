import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "../safe-redirect";

describe("safeCallbackPath", () => {
  it.each([
    "/create",
    "/create?type=moving&step=2",
    "/listing/abc#offer-1",
    "/home",
  ])("keeps the in-app path %s", (path) => {
    expect(safeCallbackPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "create",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example/x",
    "javascript:alert(1)",
    "/a\nb",
    "/a\u0000b",
    "/signin",
    "/signin?callbackUrl=/create",
    "/SIGNUP",
    "/verify-email?email=a%40b.fr",
    "/reset-password/abc",
    `/${"a".repeat(2001)}`,
  ])("refuses %j", (value) => {
    expect(safeCallbackPath(value as string | null | undefined)).toBeNull();
  });

  it("does not mistake a longer path for an auth screen", () => {
    expect(safeCallbackPath("/signing-off-notes")).toBe("/signing-off-notes");
  });
});
