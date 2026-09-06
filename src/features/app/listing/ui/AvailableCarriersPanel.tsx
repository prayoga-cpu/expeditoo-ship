"use client";

import { AlertTriangle, Route } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import {
  useContactCarrier,
  useListingCarriers,
} from "../hooks/useListingCarriers";
import { CarrierMatchCard } from "./CarrierMatchCard";

/**
 * The carriers already driving this job's trajet, each contactable in one tap.
 *
 * A discovery surface, not a second award path: it writes no offer and moves no
 * money. The thread it opens is bound to the listing, so a carrier reached here
 * lands on the thread-offer lane and bids into the same reverse auction
 * (docs/specs/carriers_on_route_spec.md §1).
 */
export function AvailableCarriersPanel({ listingId }: { listingId: string }) {
  const t = useTranslations("myJobs.carriers");
  const { data, isLoading, isError, refetch } = useListingCarriers(listingId);
  const contact = useContactCarrier(listingId);

  const items = data?.items ?? [];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("intro")}
      </p>

      {/* Failure first, and with a way out: a query surface that renders
          nothing on error is how the withdrawals 500 stayed hidden for weeks
          (CLAUDE.md gotcha 9). */}
      {isError ? (
        <CenteredEmptyState
          icon={AlertTriangle}
          title={t("loadError.title")}
          description={t("loadError.description")}
        >
          <Button variant="outline" onClick={() => void refetch()}>
            {t("loadError.retry")}
          </Button>
        </CenteredEmptyState>
      ) : isLoading ? (
        <PageLoader className="xl:min-h-[40vh]" />
      ) : items.length === 0 ? (
        <CenteredEmptyState
          icon={Route}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <div className="grid gap-4">
          {/* `total` counts carriers before the display cap, so the tab badge
              can legitimately exceed the rows. Say which, rather than let the
              two numbers quietly disagree. */}
          {data !== undefined && data.total > items.length && (
            <p className="text-sm text-muted-foreground">
              {t("truncated", { shown: items.length, total: data.total })}
            </p>
          )}
          {items.map((match) => (
            <CarrierMatchCard
              key={match.matchId}
              match={match}
              // `variables` is the matchId in flight, so the spinner stays on
              // the row that was tapped rather than on every button.
              isContacting={
                contact.isPending && contact.variables === match.matchId
              }
              // Every button locks while one is in flight: a success navigates
              // away to the thread, so a second tap could only ever be a
              // mistake or a double-fire.
              disabled={contact.isPending}
              onContact={(matchId) => contact.mutate(matchId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
