import type { NextRequest } from "next/server";
import { ok, unauthorised, handleError } from "@/lib/api-response";
import { bordereauxQuerySchema, listBordereaux } from "@/server/services/expedion-bordereaux.service";
import { resolveViewer } from "@/server/services/viewer.service";

/** GET /api/admin/expedion/bordereaux?q&page&limit — the flat slip table. Staff only. */
export async function GET(request: NextRequest) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    const query = bordereauxQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return ok(await listBordereaux(viewer, query));
  } catch (error) {
    return handleError(error, "Admin list bordereaux");
  }
}
