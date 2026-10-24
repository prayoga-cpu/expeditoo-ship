import type { ListingStatus } from "./types";

/**
 * Theme-token tones so a status badge reads correctly in light and dark.
 *
 * Shared between `/listings/me` (`MyRequestsPanel`) and the home dashboard's
 * own-request card, so the same status never wears two different colors
 * depending on which screen the caller is looking at.
 */
export const STATUS_TONE: Record<ListingStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  open: "bg-success/15 text-success border-success/30",
  awarded: "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-warning/15 text-warning border-warning/30",
  scheduled: "bg-primary/15 text-primary border-primary/30",
};

/**
 * The status to *show*: an open request whose bidding deadline has passed
 * reads « Expirée », whether or not the expiry sweep has reached it yet.
 *
 * The sweep is the writer and stays the only one; this is display only. It
 * exists because the sweep had never run in production (the scheduled-jobs
 * workflow was missing its URL and secret), and requests from September went
 * on reading « Ouverte » on « Mes demandes » and in the admin, while the board
 * — which filters on `expires_at` itself — had long stopped showing them
 * (client_feedback_2026_10_21_spec.md §X1).
 */
export function displayStatus(
  job: { status: ListingStatus; expiresAt?: string | null },
  now: Date = new Date()
): ListingStatus {
  if (
    job.status === "open" &&
    job.expiresAt &&
    new Date(job.expiresAt).getTime() < now.getTime()
  ) {
    return "expired";
  }
  return job.status;
}
