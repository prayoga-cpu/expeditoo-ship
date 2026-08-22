import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { locales } from "../config";

/**
 * FR/EN parity was previously held by hand and verified by reading. That works
 * until it does not: a key added to one catalogue and forgotten in the other
 * renders as the raw key path in the other language, and nothing fails.
 */

type Node = Record<string, unknown>;

/**
 * Every leaf path in a catalogue.
 *
 * Arrays are walked by index rather than treated as opaque, because the legal
 * pages hold their sections as arrays — a clause present in one language and
 * missing in the other is exactly the drift worth catching.
 */
function paths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => paths(entry, `${prefix}[${index}]`));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Node).flatMap(([key, child]) =>
      paths(child, prefix ? `${prefix}.${key}` : key)
    );
  }

  return [prefix];
}

describe("message catalogues", () => {
  it("ships one catalogue per supported locale", () => {
    expect(locales).toEqual(["fr", "en"]);
  });

  it("holds identical key sets in French and English", () => {
    const enPaths = new Set(paths(en));
    const frPaths = new Set(paths(fr));

    const missingInFr = [...enPaths].filter((path) => !frPaths.has(path));
    const missingInEn = [...frPaths].filter((path) => !enPaths.has(path));

    expect({ missingInFr, missingInEn }).toEqual({
      missingInFr: [],
      missingInEn: [],
    });
  });

  it("leaves no key with an empty string", () => {
    const empty = (catalogue: object, locale: string) =>
      paths(catalogue)
        .filter((path) => {
          const value = path
            .split(/\.|\[|\]/)
            .filter(Boolean)
            .reduce<unknown>(
              (node, key) => (node as Node)?.[key],
              catalogue as unknown
            );
          return typeof value === "string" && value.trim() === "";
        })
        .map((path) => `${locale}:${path}`);

    expect([...empty(en, "en"), ...empty(fr, "fr")]).toEqual([]);
  });
});
