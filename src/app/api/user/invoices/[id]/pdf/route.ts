import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { renderToBuffer } from "@react-pdf/renderer";
import { invoicesService } from "@/server/services/invoices.service";
import { InvoicePDF } from "@/server/pdf/InvoicePDF";
import { invoicePdfProps } from "@/lib/invoice-pdf-props";
import { unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/user/invoices/[id]/pdf
 * Download one document.
 *
 * The row is read through the service, which is where the ownership question
 * belongs (docs/rules.md §1.4, §8). This handler used to call `invoicesDal`
 * directly, compare `userId` inline, and answer `{ error: "Unauthorized" }`
 * outside the standard envelope — so the download and the e-mail action sitting
 * beside it in the same row failed in two different shapes.
 */
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) return unauthorised();

        const { id } = await params;
        const invoice = await invoicesService.getOwnedInvoice(id, session.user.id);

        const pdfBuffer = await renderToBuffer(InvoicePDF(invoicePdfProps(invoice)));

        // Convert Buffer to Uint8Array for NextResponse compatibility
        const uint8Array = new Uint8Array(pdfBuffer);
        return new NextResponse(uint8Array, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
                "Content-Length": pdfBuffer.length.toString(),
            },
        });
    } catch (error) {
        return handleError(error, "Invoice PDF");
    }
}
