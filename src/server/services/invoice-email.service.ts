import { render } from "@react-email/components";

import { invoicePdfProps, type InvoiceForPdf } from "@/lib/invoice-pdf-props";
import { InvoiceDocumentEmail } from "@/server/emails/InvoiceDocumentEmail";
import { emailService } from "@/server/services/email.service";

/**
 * Renders a stored document and mails it, attached.
 *
 * Its own module for one reason: `@react-pdf/renderer` is loaded here with a
 * dynamic `import()`, and the PDF component is loaded the same way because it
 * imports the renderer at module scope. A static import would put the whole
 * renderer into the import graph of every route that reaches
 * `lib/api-response.ts` — 59 of them — through
 * `api-response → shipment.service → invoices.service`, so awarding a job would
 * pay a PDF renderer's cold start for a document it is not rendering.
 */

/** What a document costs to attach; anything larger is a bug, not a big PDF. */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

async function renderDocument(invoice: InvoiceForPdf): Promise<Buffer> {
  const [{ renderToBuffer }, { InvoicePDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/server/pdf/InvoicePDF"),
  ]);

  return renderToBuffer(InvoicePDF(invoicePdfProps(invoice)));
}

export async function invoiceDocumentEmail(
  invoice: InvoiceForPdf & { user?: { name?: string | null } | null },
  to: string
) {
  const props = invoicePdfProps(invoice);
  const pdf = await renderDocument(invoice);

  if (pdf.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `Rendered ${invoice.invoiceNumber} at ${pdf.length} bytes, over the attachment ceiling`
    );
  }

  const amountLabel = `${(Math.abs(invoice.amount) / 100).toFixed(2)} €`;
  const isCreditNote = invoice.kind === "credit_note";

  const html = await render(
    InvoiceDocumentEmail({
      recipientName: props.buyerName,
      documentTitle: props.documentTitle,
      documentNumber: props.documentNumber,
      amountLabel: isCreditNote ? `− ${amountLabel}` : amountLabel,
      isCreditNote,
      jobTitle: invoice.payment?.listing?.title ?? null,
      correctsDocumentNumber: props.correctsDocumentNumber ?? null,
      invoicesUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://expeditoo.com"}/profile/invoices`,
    })
  );

  return emailService.sendEmail({
    to,
    subject: `${props.documentTitle} ${props.documentNumber} — ${amountLabel}`,
    html,
    attachments: [
      {
        filename: `${invoice.invoiceNumber}.pdf`,
        // Base64, not the Buffer: the Resend SDK JSON-encodes its body, so a
        // Buffer goes over the wire as {"type":"Buffer","data":[…]} and the
        // attachment arrives corrupt with no error anywhere.
        content: pdf.toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });
}
