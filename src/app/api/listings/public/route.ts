import { NextRequest, NextResponse } from "next/server";
import { publicListingsQuerySchema } from "@/server/dto/listings.dto";
import { listingsService } from "@/server/services/listings.service";

/**
 * GET /api/listings/public
 * Fetch all active public listings with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const queryObj = {
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      priceMin: searchParams.get("priceMin") || undefined,
      priceMax: searchParams.get("priceMax") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sizes: searchParams.get("sizes") || undefined,
      minRating: searchParams.get("minRating") || undefined,
      minReputation: searchParams.get("minReputation") || undefined,
      lat: searchParams.get("lat") || undefined,
      lng: searchParams.get("lng") || undefined,
      radiusKm: searchParams.get("radiusKm") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    };

    // Validate with DTO
    const validation = publicListingsQuerySchema.safeParse(queryObj);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: validation.error.format(),
          },
        },
        { status: 400 }
      );
    }

    // Fetch listings from service (now returns paginated result)
    const result = await listingsService.getPublicListings(validation.data);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get public listings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch listings",
        },
      },
      { status: 500 }
    );
  }
}
