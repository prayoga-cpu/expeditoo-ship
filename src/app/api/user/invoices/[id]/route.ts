import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ok, unauthorised, handleError } from "@/lib/api-response";
import { invoicesService } from "@/server/services/invoices.service";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/user/invoices/[id]
 * Get a specific document by ID.
 *
 * Refusals come from the service as typed errors now. This handler used to
 * match on the *text* of a bare `Error` to decide between 403 and 500, which
 * held only for as long as nobody rephrased the message.
 */
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) return unauthorised();

        const { id } = await params;
        const invoice = await invoicesService.getOwnedInvoice(id, session.user.id);

        return ok({ invoice });
    } catch (error) {
        return handleError(error, "Invoice");
    }
}
