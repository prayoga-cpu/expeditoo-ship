import { redirect } from "next/navigation";

/**
 * Retired in favour of `/admin/expedion`, which absorbed this dashboard's four
 * KPIs alongside the Expedion funnel and the operator queues.
 *
 * Kept as a redirect rather than deleted: the path is in browser histories and
 * bookmarks, and it was the admin landing page until now.
 */
export default function DashboardPage() {
  redirect("/admin/expedion");
}
