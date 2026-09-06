import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { invoicePdfProps, type InvoiceForPdf } from "@/lib/invoice-pdf-props";
import { invoiceIssuer, vatMention } from "@/lib/invoice-issuer";

/**
 * Covers docs/specs/invoice_at_payment_spec.md §4 — what the document is
 * allowed to claim.
 *
 * Three of these are the whole reason the feature is safe to email: it may not
 * call itself a facture while the issuer's identity is a placeholder, it may
 * not stamp PAYÉ for a synthetic charge, and it may not be silent about VAT.
 */

const ISSUER_KEYS = [
  "INVOICE_ISSUER_NAME",
  "INVOICE_ISSUER_LEGAL_FORM",
  "INVOICE_ISSUER_ADDRESS",
  "INVOICE_ISSUER_CAPITAL",
  "INVOICE_ISSUER_SIRET",
  "INVOICE_ISSUER_RCS",
  "INVOICE_ISSUER_VAT_NUMBER",
  "INVOICE_ISSUER_EMAIL",
  "INVOICE_VAT_RATE",
] as const;

const givenCompleteIssuer = (over: Record<string, string> = {}) => {
  process.env.INVOICE_ISSUER_NAME = "Atout Global Services";
  process.env.INVOICE_ISSUER_LEGAL_FORM = "SAS";
  process.env.INVOICE_ISSUER_ADDRESS = "1 rue de Rivoli, 75001 Paris";
  process.env.INVOICE_ISSUER_SIRET = "12345678900012";
  process.env.INVOICE_ISSUER_RCS = "Paris B 123 456 789";
  process.env.INVOICE_ISSUER_VAT_NUMBER = "FR12345678900";
  process.env.INVOICE_VAT_RATE = "20";
  Object.assign(process.env, over);
};

const invoice = (over: Partial<InvoiceForPdf> = {}): InvoiceForPdf => ({
  invoiceNumber: "INV-2026-0001",
  amount: 18_000,
  currency: "eur",
  status: "paid",
  kind: "invoice",
  issuedAt: new Date("2026-09-01T10:00:00Z"),
  createdAt: new Date("2026-09-01T10:00:00Z"),
  paidAt: new Date("2026-09-01T10:00:00Z"),
  dueAt: null,
  billingName: "Camille Roux",
  billingEmail: "camille@example.com",
  payment: {
    source: "stripe",
    stripePaymentIntentId: "pi_3RealCharge",
    listing: { title: "Palette Lyon → Paris" },
  },
  ...over,
});

beforeEach(() => {
  for (const key of ISSUER_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ISSUER_KEYS) delete process.env[key];
});

// ========================================
// What it calls itself
// ========================================

describe("the document's title", () => {
  it("is a reçu while the issuer's identity is a placeholder", () => {
    // Every legal identifier is TODO(EXPEDITOO-LEGAL); a document headed
    // *Facture* carrying none of them is not one (spec §4.1).
    expect(invoicePdfProps(invoice()).documentTitle).toBe("Reçu de paiement");
  });

  it("says so in the footer, in the wording the carrier statement already uses", () => {
    expect(invoicePdfProps(invoice()).footerNote).toContain("ne vaut pas facture");
  });

  it("becomes a facture once the identity is configured", () => {
    givenCompleteIssuer();

    const props = invoicePdfProps(invoice());

    expect(props.documentTitle).toBe("Facture");
    expect(props.footerNote).not.toContain("ne vaut pas facture");
    expect(props.issuer.siret).toBe("12345678900012");
  });

  it("stays a reçu when one identifier is still missing", () => {
    givenCompleteIssuer();
    delete process.env.INVOICE_ISSUER_SIRET;

    expect(invoicePdfProps(invoice()).documentTitle).toBe("Reçu de paiement");
  });

  it("accepts an issuer under the franchise, which has no VAT number", () => {
    givenCompleteIssuer({ INVOICE_VAT_RATE: "0" });
    delete process.env.INVOICE_ISSUER_VAT_NUMBER;

    expect(invoiceIssuer().isComplete).toBe(true);
  });

  it("names a correction an avoir", () => {
    const props = invoicePdfProps(invoice({ kind: "credit_note", amount: -18_000 }));

    expect(props.documentTitle).toBe("Avoir de paiement");
    expect(props.total).toBe(-18_000);
    expect(props.isPaid).toBe(false);
  });

  it("names the document the avoir corrects", () => {
    // The footer says "la facture référencée ci-dessus", so there has to be a
    // reference; a negative document that names nothing reads as a fresh sale
    // at a negative price.
    const props = invoicePdfProps(
      invoice({
        kind: "credit_note",
        amount: -18_000,
        relatedInvoiceId: "inv-1",
        relatedInvoiceNumber: "INV-2026-0001",
      })
    );

    expect(props.correctsDocumentNumber).toBe("INV-2026-0001");
  });

  it("carries no correction reference on an ordinary document", () => {
    expect(invoicePdfProps(invoice()).correctsDocumentNumber).toBeUndefined();
  });
});

// ========================================
// What it says about the money
// ========================================

describe("the paid claim", () => {
  it("stamps a real charge that settled", () => {
    expect(invoicePdfProps(invoice()).isPaid).toBe(true);
  });

  it("never stamps a synthetic charge", () => {
    // MOCK_PAYMENTS writes `captured` rows with no money behind them, and that
    // is the lane user testing runs on (spec §4.2).
    const props = invoicePdfProps(
      invoice({
        payment: { source: "stripe", stripePaymentIntentId: "pi_mock_ship-1" },
      })
    );

    expect(props.isPaid).toBe(false);
    expect(props.testNotice).toContain("aucun montant n'a été débité");
  });

  it("never stamps a document whose payment is gone, and does not call it a test", () => {
    const props = invoicePdfProps(invoice({ payment: null }));

    expect(props.isPaid).toBe(false);
    expect(props.testNotice).toBeUndefined();
  });

  it("never stamps money another company took", () => {
    const props = invoicePdfProps(
      invoice({ payment: { source: "expedion", stripePaymentIntentId: null } })
    );

    expect(props.isPaid).toBe(false);
    // Not a test charge either — that client really was debited, elsewhere.
    expect(props.testNotice).toBeUndefined();
  });
});

// ========================================
// What it says about VAT
// ========================================

describe("the VAT treatment", () => {
  it("refuses to be silent when no position is stated", () => {
    const props = invoicePdfProps(invoice());

    expect(props.vatMention).toContain("ne ventile pas la TVA");
    expect(props.vat).toBe(0);
    expect(props.subtotal).toBe(props.total);
  });

  it("carries the franchise mention at a zero rate", () => {
    givenCompleteIssuer({ INVOICE_VAT_RATE: "0" });

    expect(invoicePdfProps(invoice()).vatMention).toContain("293 B");
  });

  it("splits the charged amount into HT and TVA at a stated rate", () => {
    givenCompleteIssuer({ INVOICE_VAT_RATE: "20" });

    const props = invoicePdfProps(invoice());

    // The stored amount is what the client paid, so it is the TTC figure.
    expect(props.total).toBe(18_000);
    expect(props.subtotal).toBe(15_000);
    expect(props.vat).toBe(3_000);
  });

  it("splits a facture and its avoir to figures that cancel exactly", () => {
    givenCompleteIssuer({ INVOICE_VAT_RATE: "20" });

    // 12003 is one of the totals where rounding the *signed* value broke the
    // pair: Math.round breaks ties toward +infinity, so the two VAT figures
    // summed to −1 centime instead of zero.
    const facture = invoicePdfProps(invoice({ amount: 12_003 }));
    const avoir = invoicePdfProps(
      invoice({ kind: "credit_note", amount: -12_003 })
    );

    expect(facture.vat + avoir.vat).toBe(0);
    expect(facture.subtotal + avoir.subtotal).toBe(0);
    expect(facture.total + avoir.total).toBe(0);
  });

  it("ignores a rate that does not parse rather than inventing one", () => {
    givenCompleteIssuer({ INVOICE_VAT_RATE: "vingt" });

    const issuer = invoiceIssuer();

    expect(issuer.vatRate).toBeUndefined();
    expect(issuer.isComplete).toBe(false);
    expect(vatMention(issuer)).toContain("ne ventile pas la TVA");
  });
});

// ========================================
// Who and what it names
// ========================================

describe("the billed party and the prestation", () => {
  it("prints the block frozen at issue, not the live account", () => {
    const props = invoicePdfProps(
      invoice({
        billingName: "Camille Roux",
        billingAddress: "12 rue de la Paix, 75002 Paris, France",
        user: { name: "Renamed Since", email: "new@example.com" },
      })
    );

    expect(props.buyerName).toBe("Camille Roux");
    expect(props.buyerAddress).toBe("12 rue de la Paix, 75002 Paris, France");
  });

  it("falls back to the live account on a document issued before the snapshot", () => {
    const props = invoicePdfProps(
      invoice({
        billingName: null,
        billingEmail: null,
        user: { name: "Camille Roux", email: "camille@example.com" },
      })
    );

    expect(props.buyerName).toBe("Camille Roux");
    expect(props.buyerEmail).toBe("camille@example.com");
  });

  it("dates the document in Paris, not in the server's zone", () => {
    // 23:30 Paris on 1 September is 21:30 UTC — the same instant, and the
    // server renders in UTC, so this printed 01/09 only by accident of the
    // hour. An hour later it printed the previous day on the client's receipt.
    const props = invoicePdfProps(
      invoice({
        issuedAt: new Date("2026-09-01T22:30:00Z"),
        paidAt: new Date("2026-09-01T22:30:00Z"),
      })
    );

    expect(props.issueDate).toBe("02/09/2026");
  });

  it("designates a prestation rather than passing a job headline through", () => {
    expect(invoicePdfProps(invoice()).items[0].description).toBe(
      "Transport de marchandises — Palette Lyon → Paris"
    );
  });

  it("still designates something when the job is gone", () => {
    const props = invoicePdfProps(
      invoice({ lineDescription: null, payment: { source: "stripe", listing: null } })
    );

    expect(props.items[0].description).toBe("Transport de marchandises");
  });
});
