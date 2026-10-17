import { describe, expect, it } from "vitest";

import fr from "../../../../../messages/fr.json";
import en from "../../../../../messages/en.json";
import { resolveIdentityRows, type IdentityRow } from "../useLegalIdentity";

/** launch_readiness_spec.md §A.4 — the mentions légales fill from saved details. */

const rows = (messages: typeof fr) =>
  messages.marketing.legalNotice.identity as IdentityRow[];

describe("resolveIdentityRows", () => {
  it("fills a pending row with its saved value and leaves the unsaved ones pending", () => {
    const resolved = resolveIdentityRows(rows(fr), {
      legalName: "Atout Global Services",
      siret: "12345678900012",
      capital: null,
    });

    const byField = Object.fromEntries(resolved.map((r) => [r.field ?? r.label, r]));
    expect(byField.legalName).toMatchObject({ value: "Atout Global Services", pending: false });
    expect(byField.siret).toMatchObject({ value: "12345678900012", pending: false });
    expect(byField.capital.pending).toBe(true);
    expect(byField.Site.value).toBe("expeditoo.com");
  });

  it("changes nothing when the identity could not be read", () => {
    expect(resolveIdentityRows(rows(fr), null)).toEqual(rows(fr));
  });

  it.each([
    ["fr", fr],
    ["en", en],
  ] as const)("gives every pending row in %s a field to fill it from", (_lang, messages) => {
    const pending = rows(messages).filter((r) => r.pending);
    expect(pending.length).toBe(9);
    expect(pending.every((r) => typeof r.field === "string")).toBe(true);
  });
});
