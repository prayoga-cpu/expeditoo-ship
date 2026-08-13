import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createListingSchema } from "@/server/dto/listings.dto";
import { listingsService } from "@/server/services/listings.service";
import { headers } from "next/headers";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = createListingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const listing = await listingsService.createListing(
      session.user.id,
      validation.data
    );

    return NextResponse.json({ success: true, data: listing }, { status: 201 });
  } catch (error) {
    console.error("Create listing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(_req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        { status: 401 }
      );
    }

    const listings = await listingsService.getListingsBySeller(session.user.id);

    // Sanitize data: If status is sold/ended but endsAt is in future, override it to now
    // This fixes stale data from before the manual end fix
    const sanitizedListings = listings.map((listing) => {
      if (
        (listing.status === "sold" || listing.status === "ended") &&
        listing.endsAt &&
        new Date(listing.endsAt) > new Date()
      ) {
        return {
          ...listing,
          endsAt: new Date(), // Set to now so it shows as ended
        };
      }
      return listing;
    });

    return NextResponse.json({ success: true, data: sanitizedListings });
  } catch (error) {
    console.error("Get listings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
