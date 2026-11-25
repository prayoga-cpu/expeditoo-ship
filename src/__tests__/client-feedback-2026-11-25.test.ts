import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

/**
 * Client feedback of 2026-11-25 (docs/specs/client_feedback_2026_11_25_spec.md),
 * the parts that are words.
 */
describe("the hero's words", () => {
  it("names the service « transport partagé » in the badge", () => {
    expect(fr.marketing.hero.badge).toBe(
      "Transport partagé d'objets, meubles et déménagements · France et étranger"
    );
    expect(en.marketing.hero.badge).toBe(
      "Shared transport of items, furniture and home moves · France and abroad"
    );
  });

  it("adds « partagé » after « transporteur » in the headline, as the client asked", () => {
    expect(fr.marketing.hero.title).toBe("Trouvez un transporteur partagé pour vos objets");
    expect(en.marketing.hero.title).toBe("Find a shared carrier for the things you need moved");
  });

  it("says « Des transporteurs vous envoient leur prix », with no « vérifiés »", () => {
    expect(fr.marketing.hero.subtitle).toContain("Des transporteurs vous envoient leur prix");
  });
});

/** « Enlever le mot vérifiés après Des transporteurs » — everywhere it reads as an adjective. */
describe("« vérifiés » after « transporteurs »", () => {
  const ADJECTIVE = /(transporteurs?|déménageurs?|chauffeurs?|carriers?|movers?)\s+(vérifiés?|verified|vetted)/i;
  const strings = (node: unknown, out: string[] = []): string[] => {
    if (typeof node === "string") out.push(node);
    else if (Array.isArray(node)) node.forEach((n) => strings(n, out));
    else if (node && typeof node === "object") Object.values(node).forEach((n) => strings(n, out));
    return out;
  };

  it.each([
    ["fr", fr],
    ["en", en],
  ])("is gone from the %s catalogue", (_lang, catalogue) => {
    expect(strings(catalogue).filter((s) => ADJECTIVE.test(s))).toEqual([]);
  });
});
