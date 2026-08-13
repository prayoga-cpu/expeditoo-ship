import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listingsService } from "@/server/services/listings.service";
import {
  createListingSchema,
  browseListingsQuerySchema,
} from "@/server/dto/listings.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/listings
 * Marketplace browse. Only open jobs, visible to anyone.
 */
export async function GET(req: Request) {
  try {
    const query = browseListingsQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    return ok(await listingsService.browse(query));
  } catch (error) {
    return handleError(error, "Browse listings");
  }
}

/**
 * POST /api/listings
 * Post a transport job, as a draft or straight to the marketplace.
 */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const data = createListingSchema.parse(await req.json());

    return ok(await listingsService.createListing(session.user.id, data), 201);
  } catch (error) {
    return handleError(error, "Create listing");
  }
}
