import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/server/services/user.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getProfile(id);

    // Return only public info
    const publicUser = {
      id: user.id,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
      roles: user.roles,
      isVerified: user.isVerified,
    };

    return NextResponse.json({ success: true, data: publicUser });
  } catch (error) {
    // getProfile throws "User not found" if not found
    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        },
        { status: 404 }
      );
    }

    console.error("Error fetching user:", error);
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

