import { NextRequest, NextResponse } from "next/server";
import { listingsService } from "@/server/services/listings.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listings = await listingsService.getListingsBySeller(id);

    return NextResponse.json({ success: true, data: listings });
  } catch (error) {
    console.error("Error fetching user listings:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Internal Server Error" 
        } 
      },
      { status: 500 }
    );
  }
}
