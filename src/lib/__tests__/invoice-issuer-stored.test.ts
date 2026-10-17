import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { invoiceIssuer } from "@/lib/invoice-issuer";

/**
 * launch_readiness_spec.md §A.3 — what an admin saved wins over the deployment's
 * variables, field by field, and a facture needs a stated legal name.
 */

const KEYS = [
  "INVOICE_ISSUER_NAME",
  "INVOICE_ISSUER_LEGAL_FORM",
  "INVOICE_ISSUER_ADDRESS",
  "INVOICE_ISSUER_SIRET",
  "INVOICE_ISSUER_RCS",
  "INVOICE_ISSUER_VAT_NUMBER",
  "INVOICE_ISSUER_EMAIL",
  "INVOICE_ISSUER_CAPITAL",
  "INVOICE_VAT_RATE",
];
const before: Record<string, string | undefined> = {};

const STORED = {
  legalName: "Atout Global Services",
  legalForm: "SAS",
  address: "1bis rue Pierre et Marie Curie, 92140 Clamart",
  siret: "12345678900012",
  rcs: "RCS Nanterre 123 456 789",
  vatRate: "0",
};

beforeEach(() => {
  for (const key of KEYS) {
    before[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of KEYS) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
});

describe("invoiceIssuer(stored)", () => {
  it("is complete from the saved row alone", () => {
    const issuer = invoiceIssuer(STORED);
    expect(issuer.isComplete).toBe(true);
    expect(issuer.name).toBe("Atout Global Services");
    expect(issuer.vatRate).toBe(0);
  });

  it("prefers the saved value, and falls back to the variable for an empty one", () => {
    process.env.INVOICE_ISSUER_SIRET = "99999999999999";
    process.env.INVOICE_ISSUER_EMAIL = "env@example.fr";

    const issuer = invoiceIssuer({ ...STORED, billingEmail: "  " });

    expect(issuer.siret).toBe("12345678900012");
    expect(issuer.email).toBe("env@example.fr");
  });

  it("is not a facture under the brand name alone", () => {
    const issuer = invoiceIssuer({ ...STORED, legalName: null });
    expect(issuer.name).toBe("Expeditoo");
    expect(issuer.isComplete).toBe(false);
  });

  it("reads the variables alone when there is no row", () => {
    process.env.INVOICE_ISSUER_NAME = "From env";
    expect(invoiceIssuer(null).name).toBe("From env");
    expect(invoiceIssuer().name).toBe("From env");
  });
});
