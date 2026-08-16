import { redirect } from "next/navigation";

/**
 * "My jobs" was the shipper's own listings, back when shippers posted work
 * here. Expedion escalation is the only inlet now, so there is no such thing as
 * a job you posted — there is only the board of jobs to bid on.
 *
 * Kept as a redirect rather than deleted because the route was in the sidebar,
 * the mobile bar and the draft-save path, so it is bookmarked and linked from
 * outside this codebase.
 */
export default function MyJobsPage() {
  redirect("/expedion");
}
