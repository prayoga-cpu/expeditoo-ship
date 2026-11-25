import { afterEach, describe, expect, it } from "vitest";

import {
  LOCALE_COOKIE,
  localeFromAcceptLanguage,
  readLocaleCookie,
  resolveRequestLocale,
  setStoredLocale,
} from "../config";

/**
 * docs/specs/first_paint_language_spec.md: the server settles the language
 * before the first byte, so an English device never sees French first.
 */
describe("localeFromAcceptLanguage", () => {
  it("is French when the device says nothing", () => {
    expect(localeFromAcceptLanguage(null)).toBe("fr");
    expect(localeFromAcceptLanguage(undefined)).toBe("fr");
    expect(localeFromAcceptLanguage("")).toBe("fr");
  });

  it("reads an English device, whatever the region", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("en-GB")).toBe("en");
    expect(localeFromAcceptLanguage("EN")).toBe("en");
  });

  it("reads a French device", () => {
    expect(localeFromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(localeFromAcceptLanguage("fr-CA")).toBe("fr");
  });

  it("follows the weights, not the order, and skips a language it does not ship", () => {
    expect(localeFromAcceptLanguage("fr;q=0.4,en;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9,en;q=0.5")).toBe("en");
  });

  it("falls back to French for a language it does not ship", () => {
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9")).toBe("fr");
    expect(localeFromAcceptLanguage("*")).toBe("fr");
    expect(localeFromAcceptLanguage("en;q=0")).toBe("fr");
  });

  it("does not trip over a malformed weight", () => {
    expect(localeFromAcceptLanguage("en;q=abc,fr")).toBe("fr");
  });
});

describe("resolveRequestLocale", () => {
  it("lets the person's own choice beat the device", () => {
    expect(resolveRequestLocale("fr", "en-US")).toBe("fr");
    expect(resolveRequestLocale("en", "fr-FR")).toBe("en");
  });

  it("ignores a cookie that names a language it does not ship", () => {
    expect(resolveRequestLocale("de", "en-US")).toBe("en");
    expect(resolveRequestLocale("", null)).toBe("fr");
  });

  it("reads the device when there is no choice", () => {
    expect(resolveRequestLocale(undefined, "en-GB,en;q=0.9")).toBe("en");
  });
});

describe("the locale cookie", () => {
  afterEach(() => {
    document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
    window.localStorage.clear();
  });

  it("is written when a choice is made, and read back", () => {
    expect(readLocaleCookie()).toBeNull();
    setStoredLocale("en");
    expect(readLocaleCookie()).toBe("en");
    expect(window.localStorage.getItem("expeditoo-locale")).toBe("en");
  });
});
