import { describe, expect, it } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import {
  AUTH_ERROR_ACTIONS,
  AUTH_ERROR_CODES,
  AUTH_ERROR_KEYS,
  authErrorKey,
  thrownAuthErrorKey,
} from "../auth-errors";

/**
 * Every refusal an auth form can show is one of these keys, and each key is a
 * sentence in both languages that names what to do next (CLAUDE.md gotcha 24).
 */

describe("authErrorKey", () => {
  it.each([
    ["INVALID_EMAIL_OR_PASSWORD", "invalidCredentials"],
    ["USER_ALREADY_EXISTS", "accountExists"],
    ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "accountExists"],
    ["INVALID_EMAIL", "invalidEmail"],
    ["PASSWORD_TOO_SHORT", "passwordTooShort"],
    ["PASSWORD_TOO_LONG", "passwordTooLong"],
    ["BANNED_USER", "suspended"],
    ["INVALID_TOKEN", "invalidToken"],
  ])("maps %s to %s", (code, key) => {
    expect(authErrorKey({ code, status: 400, message: "English" })).toBe(key);
  });

  it("covers every code in the table, and nothing else", () => {
    expect(Object.keys(AUTH_ERROR_CODES).sort()).toEqual(
      [
        "BANNED_USER",
        "INVALID_EMAIL",
        "INVALID_EMAIL_OR_PASSWORD",
        "INVALID_TOKEN",
        "PASSWORD_TOO_LONG",
        "PASSWORD_TOO_SHORT",
        "USER_ALREADY_EXISTS",
        "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
      ].sort()
    );
  });

  it("reads Better Auth's code-less 429 as too many attempts", () => {
    expect(authErrorKey({ status: 429, message: "Too many requests." })).toBe(
      "rateLimited"
    );
  });

  it("prefers a known code over the status", () => {
    expect(authErrorKey({ status: 429, code: "BANNED_USER" })).toBe("suspended");
  });

  it.each([
    [{ status: 500, code: "SOMETHING_NEW", message: "boom" }],
    [{ message: "only a sentence" }],
    [{ code: "constructor" }],
    [{ code: "__proto__" }],
    [null],
    [undefined],
    ["a string"],
  ])("falls back to unknown for %j", (error) => {
    expect(authErrorKey(error)).toBe("unknown");
  });
});

describe("thrownAuthErrorKey", () => {
  it("calls a rejected fetch a connection problem", () => {
    expect(thrownAuthErrorKey(new TypeError("Failed to fetch"))).toBe("network");
  });

  it("does not blame the connection for anything else", () => {
    expect(thrownAuthErrorKey(new Error("boom"))).toBe("unknown");
    expect(thrownAuthErrorKey("boom")).toBe("unknown");
  });
});

describe("the copy", () => {
  const sentences = {
    fr: fr.auth.errors as Record<string, unknown>,
    en: en.auth.errors as Record<string, unknown>,
  };

  it.each(["fr", "en"] as const)("has a sentence for every key in %s", (lang) => {
    for (const key of AUTH_ERROR_KEYS) {
      expect(typeof sentences[lang][key], `${lang} ${key}`).toBe("string");
      expect((sentences[lang][key] as string).length).toBeGreaterThan(10);
    }
  });

  it.each(["fr", "en"] as const)("has a label for every action in %s", (lang) => {
    const actions = sentences[lang].actions as Record<string, string>;
    const labels = Object.values(AUTH_ERROR_ACTIONS)
      .flat()
      .map((action) => action.label);

    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(typeof actions[label], `${lang} ${label}`).toBe("string");
    }
  });

  it("is the same set of keys in both languages", () => {
    const leaves = (o: unknown, prefix = ""): string[] =>
      typeof o === "object" && o !== null
        ? Object.entries(o).flatMap(([k, v]) => leaves(v, `${prefix}${k}.`))
        : [prefix];

    expect(leaves(sentences.fr).sort()).toEqual(leaves(sentences.en).sort());
  });

  // A refusal that names no next step is a dead end; these name it in words
  // (wait, correct the field, write to support) or in a button.
  it("sends the two refusals that have a way back to the right pages", () => {
    expect(AUTH_ERROR_ACTIONS.invalidCredentials).toEqual([
      { label: "forgotPassword", href: "/forgot-password" },
    ]);
    expect(AUTH_ERROR_ACTIONS.accountExists.map((a) => a.href)).toEqual([
      "/signin",
      "/forgot-password",
    ]);
  });

  it.each(["fr", "en"] as const)(
    "gives the suspended and unknown notices the support address in %s",
    (lang) => {
      expect(sentences[lang].suspended).toContain("{support}");
      expect(sentences[lang].unknown).toContain("{support}");
    }
  );

  it.each(["fr", "en"] as const)("tells a rate limit to wait, in %s", (lang) => {
    expect(sentences[lang].rateLimited as string).toMatch(/minute/);
  });
});
