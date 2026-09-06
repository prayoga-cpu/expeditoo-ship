import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { render } from "@react-email/components";

import { InvoicePDF, InvoiceBatchPDF } from "../InvoicePDF";
import { InvoiceDocumentEmail } from "@/server/emails/InvoiceDocumentEmail";
import { invoicePdfProps, type InvoiceForPdf } from "@/lib/invoice-pdf-props";

/**
 * The document is now *emailed*, so a render that throws is no longer a broken
 * download somebody reports — it is a charge with no receipt behind it. These
 * cases render for real rather than asserting on props.
 */

const ISSUER_KEYS = [
  "INVOICE_ISSUER_NAME",
  "INVOICE_ISSUER_LEGAL_FORM",
  "INVOICE_ISSUER_ADDRESS",
  "INVOICE_ISSUER_SIRET",
  "INVOICE_ISSUER_RCS",
  "INVOICE_ISSUER_VAT_NUMBER",
  "INVOICE_VAT_RATE",
] as const;

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
  billingAddress: "12 rue de la Paix, 75002 Paris, France",
  lineDescription: "Transport de marchandises — Palette Lyon → Paris",
  payment: {
    source: "stripe",
    stripePaymentIntentId: "pi_3RealCharge",
    listing: { title: "Palette Lyon → Paris" },
  },
  ...over,
});

const isPdf = (buffer: Buffer) =>
  buffer.length > 0 && buffer.subarray(0, 5).toString() === "%PDF-";

beforeEach(() => {
  for (const key of ISSUER_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ISSUER_KEYS) delete process.env[key];
});

describe("rendering the document", () => {
  it("renders a receipt while the issuer identity is unset", async () => {
    const buffer = await renderToBuffer(InvoicePDF(invoicePdfProps(invoice())));

    expect(isPdf(buffer)).toBe(true);
  });

  it("renders a facture with the full identity and a VAT split", async () => {
    process.env.INVOICE_ISSUER_NAME = "Atout Global Services";
    process.env.INVOICE_ISSUER_LEGAL_FORM = "SAS";
    process.env.INVOICE_ISSUER_ADDRESS = "1 rue de Rivoli, 75001 Paris";
    process.env.INVOICE_ISSUER_SIRET = "12345678900012";
    process.env.INVOICE_ISSUER_RCS = "Paris B 123 456 789";
    process.env.INVOICE_ISSUER_VAT_NUMBER = "FR12345678900";
    process.env.INVOICE_VAT_RATE = "20";

    const buffer = await renderToBuffer(InvoicePDF(invoicePdfProps(invoice())));

    expect(isPdf(buffer)).toBe(true);
  });

  it("renders a credit note, whose amount is negative", async () => {
    const buffer = await renderToBuffer(
      InvoicePDF(invoicePdfProps(invoice({ kind: "credit_note", amount: -18_000 })))
    );

    expect(isPdf(buffer)).toBe(true);
  });

  it("renders a document whose payment and account are both gone", async () => {
    const buffer = await renderToBuffer(
      InvoicePDF(
        invoicePdfProps(
          invoice({
            payment: null,
            user: null,
            billingName: null,
            billingEmail: null,
            billingAddress: null,
            lineDescription: null,
          })
        )
      )
    );

    expect(isPdf(buffer)).toBe(true);
  });

  it("renders an empty period bundle rather than refusing one", async () => {
    const buffer = await renderToBuffer(
      InvoiceBatchPDF({
        invoices: [],
        periodLabel: "Toutes périodes",
        emptyLabel: "Aucune facture sur cette période.",
      })
    );

    expect(isPdf(buffer)).toBe(true);
  });

  it("renders a period bundle of several documents", async () => {
    const buffer = await renderToBuffer(
      InvoiceBatchPDF({
        invoices: [
          { key: "a", ...invoicePdfProps(invoice()) },
          {
            key: "b",
            ...invoicePdfProps(
              invoice({ invoiceNumber: "AV-2026-0001", kind: "credit_note", amount: -18_000 })
            ),
          },
        ],
        periodLabel: "01/09/2026 — 30/09/2026",
        emptyLabel: "Aucune facture sur cette période.",
      })
    );

    expect(isPdf(buffer)).toBe(true);
  });
});

describe("the covering email", () => {
  it("names the document it carries", async () => {
    const props = invoicePdfProps(invoice());

    const html = await render(
      InvoiceDocumentEmail({
        recipientName: props.buyerName,
        documentTitle: props.documentTitle,
        documentNumber: props.documentNumber,
        amountLabel: "180.00 €",
        isCreditNote: false,
        jobTitle: "Palette Lyon → Paris",
        invoicesUrl: "https://expeditoo.com/profile/invoices",
      })
    );

    expect(html).toContain("Reçu de paiement");
    expect(html).toContain("INV-2026-0001");
    expect(html).toContain("180.00");
  });

  it("says a refund happened when it carries a credit note", async () => {
    const html = await render(
      InvoiceDocumentEmail({
        recipientName: "Camille Roux",
        documentTitle: "Avoir de paiement",
        documentNumber: "AV-2026-0001",
        amountLabel: "− 180.00 €",
        isCreditNote: true,
        jobTitle: null,
        invoicesUrl: "https://expeditoo.com/profile/invoices",
      })
    );

    expect(html).toContain("remboursé");
  });
});
