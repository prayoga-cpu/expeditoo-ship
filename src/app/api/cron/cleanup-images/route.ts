import { imageCleanupService } from "@/server/services/image-cleanup.service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes timeout for Vercel (Pro plan)

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const querySecret = searchParams.get("secret");
    const dryRun = searchParams.get("dryRun") !== "false"; // Default to true if not specified as false

    // Verify Secret
    const expectedSecret = process.env.CRON_SECRET;
    if (
      !expectedSecret ||
      (authHeader !== `Bearer ${expectedSecret}` && querySecret !== expectedSecret)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await imageCleanupService.performCleanup(dryRun);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Cleanup job failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
