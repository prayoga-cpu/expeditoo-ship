import { parseUserInput } from "better-auth/db";
import { describe, expect, it } from "vitest";

import { USER_ADDITIONAL_FIELDS } from "../auth-user-fields";

/**
 * client_feedback_2026_10_spec.md §11 and §1, run through Better Auth's own
 * input parser — the function `sign-up/email` and `update-user` call — with
 * this app's field config, so the test proves what the library does with it.
 */

const options = { user: { additionalFields: USER_ADDITIONAL_FIELDS } } as never;
const base = { name: "Jean Dupont", email: "jean@example.com" };

const create = (extra: Record<string, unknown>) =>
  parseUserInput(options, { ...base, ...extra }, "create") as Record<string, unknown>;
const update = (extra: Record<string, unknown>) =>
  parseUserInput(options, extra, "update") as Record<string, unknown>;

describe("the account flags a client must not set", () => {
  it("signs a new account up unverified and unbanned whatever it asks", () => {
    const parsed = create({ isVerified: true, banned: false });
    expect(parsed.isVerified).toBe(false);
    expect(parsed.banned).toBe(false);
  });

  it("refuses a Stripe account id or status at sign-up", () => {
    expect(() => create({ stripeAccountId: "acct_someone_else" })).toThrow();
  });

  it("refuses every flag on update-user", () => {
    expect(() => update({ isVerified: true })).toThrow();
    expect(() => update({ banned: true })).toThrow();
    expect(() => update({ stripeAccountId: "acct_someone_else" })).toThrow();
    expect(() => update({ stripeAccountStatus: "active" })).toThrow();
  });
});

describe("the name parts a client may set", () => {
  it("takes trimmed first and last names and an alias", () => {
    const parsed = create({ firstName: "  Jean ", lastName: "Dupont", alias: " Jeannot " });
    expect(parsed.firstName).toBe("Jean");
    expect(parsed.lastName).toBe("Dupont");
    expect(parsed.alias).toBe("Jeannot");
  });

  it("refuses an empty or an overlong name and an overlong alias", () => {
    expect(() => create({ firstName: "   " })).toThrow();
    expect(() => create({ lastName: "x".repeat(81) })).toThrow();
    expect(() => create({ alias: "x".repeat(41) })).toThrow();
  });
});
