import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api-response";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isImpersonated } from "@/lib/impersonation-guard";
import { contactSubmitSchema } from "@/server/dto/contact.dto";
import { contactService } from "@/server/services/contact.service";

export const dynamic = "force-dynamic";

/** Five enquiries per ten minutes from one address. */
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * POST /api/contact
 *
 * Public on purpose — the point of the page is that somebody with no account
 * can reach support. A session is read when there is one, only so the enquiry
 * can also be dropped into that person's support thread; nothing here depends
 * on it. Permissions stay in the service (docs/rules.md §3.4); the route
 * resolves identity and translates errors.
 */
export async function POST(req: NextRequest) {
  try {
    const requestHeaders = await headers();

    const limit = rateLimit(
      `contact:${clientIp(requestHeaders)}`,
      LIMIT,
      WINDOW_MS
    );
    if (!limit.allowed) {
      return fail(
        "CONTACT_RATE_LIMITED",
        `Too many messages. Try again in ${limit.retryAfter} seconds.`,
        429
      );
    }

    const input = contactSubmitSchema.parse(await req.json());

    // An unauthenticated caller is the expected case, so a session lookup that
    // finds nothing is not an error.
    const session = await auth.api.getSession({ headers: requestHeaders });

    const result = await contactService.submit(input, {
      sender: session?.user
        ? {
            id: session.user.id,
            name: session.user.name ?? null,
            image: session.user.image ?? null,
          }
        : null,
      impersonated: isImpersonated(session),
    });

    return ok(result);
  } catch (error) {
    return handleError(error, "POST /api/contact");
  }
}
