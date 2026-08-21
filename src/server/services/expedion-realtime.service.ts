/**
 * ============================================================================
 * Realtime dashboard signal — Expedion admin report
 * ============================================================================
 *
 * The operator report (`/admin/expedion`) has no polling: its query is a
 * handful of full-table aggregates, expensive enough that refetching it on a
 * timer would repeatedly load a connection pool that has already choked once
 * (`expedion-report.service.ts`'s comments cover that incident). Instead,
 * every write that changes what the report shows calls `notifyExpedionAdmins`
 * after it commits, and `AblySubscriptions.tsx`'s `"expedion"` case turns the
 * signal into a query invalidation — so an operator watching the dashboard
 * sees a new quote, a payment, or an escalation land without refreshing.
 *
 * There is no admin-wide Ably channel (see `ably.service.ts`'s token
 * capability, which only grants a user its own `user:{id}:stream`), so this
 * fans out over every admin's private stream instead — the same channel
 * their message badge and notifications already ride on.
 *
 * Best-effort like every other Ably publish in this codebase: a failed
 * fan-out must never fail the write that triggered it.
 */

import { ablyServer } from "@/lib/ably-server";
import { getUsersByRole } from "@/server/dal/users.dal";

export async function notifyExpedionAdmins(resourceId?: string): Promise<void> {
  try {
    const admins = await getUsersByRole("admin");
    await Promise.all(
      admins.map((admin) =>
        ablyServer.publishDataUpdate(admin.id, {
          type: "expedion",
          resourceId,
        })
      )
    );
  } catch (error) {
    console.error("[expedion] admin realtime notify failed", error);
  }
}
