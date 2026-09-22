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
