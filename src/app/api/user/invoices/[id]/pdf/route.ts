import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { invoicesDal } from "@/server/dal/invoices.dal";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/server/pdf/InvoicePDF";

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

        // Generate PDF
        const pdfBuffer = await renderToBuffer(
            InvoicePDF({
                invoiceNumber: invoice.invoiceNumber,
                invoiceDate: invoice.issuedAt
                    ? new Date(invoice.issuedAt).toLocaleDateString("fr-FR")
                    : new Date(invoice.createdAt).toLocaleDateString("fr-FR"),
                dueDate: invoice.dueAt
                    ? new Date(invoice.dueAt).toLocaleDateString("fr-FR")
                    : undefined,
                isPaid: invoice.status === "paid",
                paidDate: invoice.paidAt
                    ? new Date(invoice.paidAt).toLocaleDateString("fr-FR")
                    : undefined,
                companyName: "Expeditoo",
                companyAddress: "Paris, France",
                companyEmail: "invoices@expeditoo.com",
                buyerName: invoice.user?.name || "Customer",
                buyerEmail: invoice.user?.email || "",
                buyerAddress: undefined, // Could be fetched from addresses if needed
                items: [
                    {
                        description: "Marketplace Purchase",
                        quantity: 1,
                        unitPrice: invoice.amount,
                    },
                ],
                subtotal: invoice.amount,
                shippingFee: 0, // Could be included from payment details
                tax: 0,
                total: invoice.amount,
                currency: invoice.currency.toUpperCase(),
            })
        );

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
