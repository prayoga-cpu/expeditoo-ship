import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { invoicesService } from "@/server/services/invoices.service";
import { InvoiceBatchPDF } from "@/server/pdf/InvoicePDF";
import { invoicePdfProps } from "@/lib/invoice-pdf-props";
import {
  statementPeriodSchema,
  periodLabel,
  periodSlug,
} from "@/lib/statement-period";
import { unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/user/invoices/statement
 * Every invoice in a period, one page each — the Cocolis
 * "Télécharger toutes les factures de la période" button.
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const period = statementPeriodSchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    const invoices = await invoicesService.getPeriodInvoices(
      session.user.id,
      period
    );

    const buffer = await renderToBuffer(
      InvoiceBatchPDF({
        invoices: invoices.map((invoice) => ({
          key: invoice.id,
          ...invoicePdfProps({ ...invoice, user: session.user }),
        })),
        periodLabel: periodLabel(period, "Toutes périodes"),
        emptyLabel: "Aucune facture sur cette période.",
      })
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="factures-${periodSlug(period)}.pdf"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    return handleError(error, "Invoice statement");
  }
}
