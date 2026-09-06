import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ok, unauthorised, handleError } from "@/lib/api-response";
import { invoicesService } from "@/server/services/invoices.service";
import { invoiceQuerySchema } from "@/server/dto/invoices.dto";

/**
 * GET /api/user/invoices
 * Every document belonging to the caller.
 *
 * The whole query string is parsed, not a hand-picked three. `from` and `to`
 * were declared on `invoiceQuerySchema`, sent by the screen and read by the
 * DAL, but never lifted out of the URL here — so the period dropdown filtered
 * the bulk download and did nothing at all to the list beside it.
 */
export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) return unauthorised();

        const query = invoiceQuerySchema.parse(
            Object.fromEntries(new URL(request.url).searchParams)
        );

        return ok(await invoicesService.getUserInvoices(session.user.id, query));
    } catch (error) {
        return handleError(error, "Invoices");
    }
}
