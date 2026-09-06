import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ok, fail, unauthorised, handleError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { invoicesService } from "@/server/services/invoices.service";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/** Five sends an hour per document. A re-send is a convenience, not a firehose. */
const SENDS_PER_HOUR = 5;

/**
 * POST /api/user/invoices/[id]/email
 * Send the document again, to the account it belongs to.
 *
 * It takes no recipient, deliberately. An endpoint that mails a PDF wherever it
 * is told is an open relay carrying this platform's domain
 * (docs/specs/invoice_at_payment_spec.md §7.2). The response masks the address
 * it went to: the caller holds the session, which is not the same as needing the
 * address restated to them.
 */
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) return unauthorised();

        const { id } = await params;
        const invoice = await invoicesService.getOwnedInvoice(id, session.user.id);

        const limit = rateLimit(
            `invoice-email:${session.user.id}:${invoice.id}`,
            SENDS_PER_HOUR,
            60 * 60 * 1000
        );
        if (!limit.allowed) {
            return fail(
                "RATE_LIMITED",
                `Trop d'envois. Réessayez dans ${limit.retryAfter} s.`,
                429
            );
        }

        const { sentTo } = await invoicesService.sendDocumentEmail(invoice.id);

        return ok({ sentTo: mask(sentTo) });
    } catch (error) {
        return handleError(error, "Invoice email");
    }
}

/**
 * `client@example.com` → `c***@example.com`.
 *
 * Fixed width rather than proportional: the point is to confirm which inbox it
 * reached, not to publish how long the address is.
 */
function mask(address: string): string {
    const [local, domain] = address.split("@");
    if (!domain || !local) return address;

    return `${local.slice(0, 1)}***@${domain}`;
}
