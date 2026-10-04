"use client";

import { TriangleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { PublicationIssues } from "../publication";

/** Day, short month, hour — the same reading `RequestSummary` gives a window. */
export const MOMENT_FORMAT = {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
} as const;

interface PickupPublicationNoticeProps {
  publication: PublicationIssues;
  /** Step 4 only: a way back to the dates the problem is about. */
  onEditDates?: () => void;
}

/**
 * Whether the pickup leaves carriers time to make an offer, said where the
 * dates are (publication_timing_spec.md §3.3): an error when publishing is not
 * possible, a warning when bidding would close within six hours.
 *
 * The error blocks « Publier » and nothing else, so it carries a marker of its
 * own, `data-publication-error`: « Publier » scrolls to it, while a refused
 * « Suivant » scrolls to the schema error that actually stopped it.
 */
export function PickupPublicationNotice({
  publication,
  onEditDates,
}: PickupPublicationNoticeProps) {
  const t = useTranslations("create.publication");
  const format = useFormatter();
  const moment = (date: Date) => format.dateTime(date, MOMENT_FORMAT);
  const { pickup, biddingClosesAt } = publication;

  if (pickup) {
    return (
      <div
        data-publication-error
        className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
      >
        <p>
          {pickup.kind === "inPast"
            ? t("pickupInPast")
            : t("pickupTooSoon", { earliest: moment(pickup.earliest) })}
        </p>
        {onEditDates && (
          <Button type="button" variant="outline" size="sm" onClick={onEditDates}>
            {t("editDates")}
          </Button>
        )}
      </div>
    );
  }

  // A warning, not an error: it blocks nothing. Amber is carried by the icon
  // and the tint — amber text on the card measured 3.75:1, under the 4.5:1 a
  // sentence of this size needs.
  if (biddingClosesAt) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <span>{t("biddingShort", { closesAt: moment(biddingClosesAt) })}</span>
      </p>
    );
  }

  return null;
}
