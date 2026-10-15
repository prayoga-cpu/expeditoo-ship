import { describe, expect, it } from "vitest";

import { EMPTY_SIGNUP, buildSignupSchema } from "../signup-schema";

/** client_feedback_2026_10_spec.md §1 — the sign-up form's own rules. */

const t = (key: string) => key;
const schema = buildSignupSchema(t);
const valid = {
  ...EMPTY_SIGNUP,
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean@example.com",
  password: "motdepasse",
  confirmPassword: "motdepasse",
};
const messages = (input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("buildSignupSchema", () => {
  it("accepts a first name, a last name and no alias", () => {
    expect(messages(valid)).toEqual([]);
  });

  it("asks for each part of the name on its own", () => {
    expect(messages({ ...valid, firstName: " " })).toEqual(["errors.firstNameRequired"]);
    expect(messages({ ...valid, lastName: "" })).toEqual(["errors.lastNameRequired"]);
  });

  it("caps the alias and the name parts", () => {
    expect(messages({ ...valid, alias: "x".repeat(41) })).toEqual(["errors.aliasTooLong"]);
    expect(messages({ ...valid, firstName: "x".repeat(81) })).toEqual(["errors.nameTooLong"]);
  });

  it("trims what it keeps", () => {
    const parsed = schema.parse({ ...valid, firstName: "  Jean ", alias: " Jeannot " });
    expect(parsed.firstName).toBe("Jean");
    expect(parsed.alias).toBe("Jeannot");
  });
});
