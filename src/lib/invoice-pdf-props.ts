import { isMockIntent } from "@/lib/stripe/mock-payments";
import { invoiceIssuer, vatMention, type InvoiceIssuer } from "@/lib/invoice-issuer";
import type { InvoicePDFProps } from "@/server/pdf/InvoicePDF";

/**
 * One stored document rendered as PDF props, shared by the single download, the
 * period bundle and the email attachment so the three can never drift apart.
 *
 * Three claims are made here rather than in the renderer, because each of them
 * is a statement about money and the renderer has no way to check any of them:
 * what the document is called (§4.1), whether it may say it was paid (§4.2),
 * and who it is addressed to (§4.3) — docs/specs/invoice_at_payment_spec.md.
 */
export interface InvoiceForPdf {
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  kind?: string | null;
  issuedAt: Date | string | null;
  createdAt: Date | string;
  paidAt: Date | string | null;
  dueAt: Date | string | null;
  billingName?: string | null;
  billingEmail?: string | null;
  billingAddress?: string | null;
  lineDescription?: string | null;
  relatedInvoiceId?: string | null;
  relatedInvoiceNumber?: string | null;
  payment?: {
    source?: string | null;
    stripePaymentIntentId?: string | null;
    listing?: { title: string } | null;
  } | null;
  user?: { name?: string | null; email?: string | null } | null;
}

/**
 * A French date, in French time.
 *
 * The zone is explicit because nothing else supplies one: the server renders
 * this in UTC (Vercel's default), so a payment taken at 23:30 in Paris printed
 * as the previous day on the client's own receipt. `photo-stamp.service.ts`
 * already pins `Europe/Paris` on the burned-in evidence band for exactly this
 * reason.
 */
const fr = (value: Date | string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })
    : undefined;

/**
 * Whether real money moved through *this* platform's Stripe account.
 *
 * Deliberately not `status === "paid"`. `MOCK_PAYMENTS` writes `captured` rows
 * carrying a synthetic `pi_mock_` intent and no money at all, and that is the
 * lane user testing runs on — the same guard `refundForShipment` applies before
 * it will call Stripe. A document handed to a customer may not say PAYÉ for a
 * debit that never happened.
 */
function moneyReallyMoved(invoice: InvoiceForPdf): boolean {
  const payment = invoice.payment;
  if (!payment || payment.source !== "stripe") return false;

  const intentId = payment.stripePaymentIntentId;
  return Boolean(intentId) && !isMockIntent(intentId as string);
}

/**
 * Whether the charge behind this document was synthetic.
 *
 * Decided by the intent id alone, like every other reading of it: a document
 * whose payment row has since been deleted is not a test charge, and must not
 * be labelled one.
 */
function isSyntheticCharge(invoice: InvoiceForPdf): boolean {
  const intentId = invoice.payment?.stripePaymentIntentId;
  return typeof intentId === "string" && isMockIntent(intentId);
}

/** The prestation, frozen at issue where the row carries it. */
function description(invoice: InvoiceForPdf, fallback: string): string {
  return (
    invoice.lineDescription ||
    (invoice.payment?.listing?.title
      ? `Transport de marchandises — ${invoice.payment.listing.title}`
      : fallback)
  );
}

function issuerFooter(issuer: InvoiceIssuer, isCreditNote: boolean): string {
  if (issuer.isComplete) {
    return isCreditNote
      ? "Avoir émis en correction de la facture référencée ci-dessus."
      : "Facture payable à réception. Pénalités de retard : trois fois le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €.";
  }

  return isCreditNote
    ? "Avoir de paiement — document récapitulatif, ne vaut pas facture d'avoir."
    : "Reçu de paiement — document récapitulatif, ne vaut pas facture. Une facture conforme peut être demandée à " +
        issuer.email +
        ".";
}

/**
 * What an avoir corrects, printed on its face.
 *
 * The footer says "la facture référencée ci-dessus", so there has to *be* a
 * reference above it — a negative document that cannot name what it corrects
 * reads as a fresh sale at a negative price.
 */
function correctsLabel(invoice: InvoiceForPdf): string | undefined {
  if (invoice.kind !== "credit_note") return undefined;

  return invoice.relatedInvoiceNumber ?? undefined;
}

export function invoicePdfProps(
  invoice: InvoiceForPdf,
  fallbackDescription = "Transport de marchandises"
): InvoicePDFProps {
  const issuer = invoiceIssuer();
  const isCreditNote = invoice.kind === "credit_note";
  const paid = moneyReallyMoved(invoice) && invoice.status === "paid";

  const total = invoice.amount;
  const vatRate = issuer.vatRate;
  // The stored amount is what the client was charged, so it is the TTC figure;
  // the base is derived from it rather than the other way round.
  //
  // Rounded on the magnitude and re-signed, never on the signed value:
  // `Math.round` breaks ties toward +infinity, so at 20% a facture and its avoir
  // for the same amount split one centime differently and the pair failed to sum
  // to zero.
  const net =
    vatRate === undefined || vatRate === 0
      ? total
      : Math.sign(total) * Math.round(Math.abs(total) / (1 + vatRate / 100));

  return {
    documentTitle: isCreditNote
      ? issuer.isComplete
        ? "Avoir"
        : "Avoir de paiement"
      : issuer.isComplete
        ? "Facture"
        : "Reçu de paiement",
    documentNumber: invoice.invoiceNumber,
    correctsDocumentNumber: correctsLabel(invoice),
    issueDate: fr(invoice.issuedAt) ?? fr(invoice.createdAt) ?? "",
    dueDate: fr(invoice.dueAt),
    isPaid: paid && !isCreditNote,
    paidDate: fr(invoice.paidAt),
    // A synthetic charge says so in place of the stamp, rather than leaving the
    // reader to assume a debit that never happened.
    testNotice:
      !isCreditNote && isSyntheticCharge(invoice)
        ? "Paiement simulé (environnement de test) — aucun montant n'a été débité."
        : undefined,
    issuer,
    buyerName: invoice.billingName || invoice.user?.name || "Client",
    buyerEmail: invoice.billingEmail || invoice.user?.email || "",
    buyerAddress: invoice.billingAddress || undefined,
    items: [
      {
        description: description(invoice, fallbackDescription),
        quantity: 1,
        unitPrice: net,
      },
    ],
    subtotal: net,
    vat: total - net,
    total,
    vatMention: vatMention(issuer),
    footerNote: issuerFooter(issuer, isCreditNote),
    currency: invoice.currency.toUpperCase(),
  };
}
