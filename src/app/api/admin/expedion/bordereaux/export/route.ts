import type { NextRequest } from "next/server";
import { unauthorised, handleError } from "@/lib/api-response";
import { exportBordereauxCsv } from "@/server/services/expedion-bordereaux.service";
import { resolveViewer } from "@/server/services/viewer.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/expedion/bordereaux/export?q — the same rows as a CSV. Staff only. */
export async function GET(request: NextRequest) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    const csv = await exportBordereauxCsv(viewer, request.nextUrl.searchParams.get("q")?.trim().slice(0, 100));
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bordereaux-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleError(error, "Admin export bordereaux");
  }
}
