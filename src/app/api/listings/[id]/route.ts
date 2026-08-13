import { NextResponse } from "next/server";
import { listingsService } from "@/server/services/listings.service";
import {
  updateListingStatusSchema,
  createListingSchema,
} from "@/server/dto/listings.dto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listing = await listingsService.getListingById(id);

    if (!listing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Listing not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: listing });
  } catch (error) {
    console.error("Get listing error:", error);
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();

    // Validate input
    const parsed = updateListingStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const result = await listingsService.updateListingStatus(
      id,
      session.user.id,
      parsed.data.status
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Update listing error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Not authorized")
      ? 403
      : message.includes("not found")
        ? 404
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          code:
            status === 403
              ? "FORBIDDEN"
              : status === 404
                ? "NOT_FOUND"
                : "INTERNAL_SERVER_ERROR",
          message,
        },
      },
      { status }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    await listingsService.deleteListing(id, session.user.id);

    return NextResponse.json({ success: true, message: "Listing deleted" });
  } catch (error) {
    console.error("Delete listing error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Not authorized")
      ? 403
      : message.includes("not found")
        ? 404
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          code:
            status === 403
              ? "FORBIDDEN"
              : status === 404
                ? "NOT_FOUND"
                : "INTERNAL_SERVER_ERROR",
          message,
        },
      },
      { status }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();

    // Validate input
    const parsed = createListingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const result = await listingsService.updateListing(
      id,
      session.user.id,
      parsed.data
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Update listing error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Not authorized")
      ? 403
      : message.includes("not found")
        ? 404
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          code:
            status === 403
              ? "FORBIDDEN"
              : status === 404
                ? "NOT_FOUND"
                : "INTERNAL_SERVER_ERROR",
          message,
        },
      },
      { status }
    );
  }
}
