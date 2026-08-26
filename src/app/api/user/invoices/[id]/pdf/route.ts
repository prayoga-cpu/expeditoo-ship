import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { invoicesDal } from "@/server/dal/invoices.dal";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/server/pdf/InvoicePDF";
import { invoicePdfProps } from "@/lib/invoice-pdf-props";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/user/invoices/[id]/pdf
 * Generate and download invoice PDF
 */
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const invoice = await invoicesDal.getById(id);

        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        // Verify ownership
        if (invoice.userId !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const pdfBuffer = await renderToBuffer(InvoicePDF(invoicePdfProps(invoice)));

        // Return PDF as downloadable file
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
        console.error("Error generating invoice PDF:", error);
        return NextResponse.json(
            { error: "Failed to generate invoice PDF" },
            { status: 500 }
        );
    }
}
