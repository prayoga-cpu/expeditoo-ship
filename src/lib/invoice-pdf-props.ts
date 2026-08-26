import type { InvoicePDFProps } from "@/server/pdf/InvoicePDF";

/**
 * One stored invoice rendered as PDF props, shared by the single download and
 * the period bundle so the two documents can never drift apart.
 *
 * The line item names the job. It used to read "Marketplace Purchase" — a
 * leftover from the goods marketplace, on a platform that now moves freight and
 * nothing else (billing_documents_spec.md §4.4).
 */
export interface InvoiceForPdf {
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: Date | string | null;
  createdAt: Date | string;
  paidAt: Date | string | null;
  dueAt: Date | string | null;
  payment?: { listing?: { title: string } | null } | null;
  user?: { name?: string | null; email?: string | null } | null;
}

const fr = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("fr-FR") : undefined;

export function invoicePdfProps(
  invoice: InvoiceForPdf,
  fallbackDescription = "Transport"
): InvoicePDFProps {
  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: fr(invoice.issuedAt) ?? fr(invoice.createdAt) ?? "",
    dueDate: fr(invoice.dueAt),
    isPaid: invoice.status === "paid",
    paidDate: fr(invoice.paidAt),
    companyName: "Expeditoo",
    companyAddress: "Paris, France",
    companyEmail: "invoices@expeditoo.com",
    buyerName: invoice.user?.name || "Client",
    buyerEmail: invoice.user?.email || "",
    buyerAddress: undefined,
    items: [
      {
        description: invoice.payment?.listing?.title || fallbackDescription,
        quantity: 1,
        unitPrice: invoice.amount,
      },
    ],
    subtotal: invoice.amount,
    shippingFee: 0,
    tax: 0,
    total: invoice.amount,
    currency: invoice.currency.toUpperCase(),
  };
}
