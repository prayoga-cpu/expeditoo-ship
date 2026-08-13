import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getUsers } from "@/server/services/user.service";

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("pageSize")) || 50;
  const search = searchParams.get("search") || undefined;
  const role = searchParams.get("role") || undefined;

  try {
    const result = await getUsers(
      {
        page,
        pageSize,
        search,
        role,
      },
      session.user.id
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
