"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Gavel, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { PageLoader } from "@/components/ui/page-loader";
import Link from "next/link";
import { useMyOffers, useWithdrawOffer } from "../hooks/useCarrierOffers";
import type { Offer, OfferStatus } from "@/features/app/listing/types";
import { formatCurrency } from "@/lib/currency";

const euros = formatCurrency;

const STATUS_TONE: Record<OfferStatus, string> = {
  pending: "bg-primary/10 text-primary border-primary/30",
  accepted: "bg-success/15 text-success border-success/30",
  rejected: "bg-muted text-muted-foreground border-border",
  withdrawn: "bg-muted text-muted-foreground border-border",
  expired: "bg-warning/15 text-warning border-warning/30",
};

/**
 * The carrier's own bids across every job.
 *
 * Hardcoded English until 2.75.0, and blank on a failed read; both went with
 * the dead-ends pass (no_dead_ends_spec.md §4, §6). A bid that is over —
 * expired with an edited request, rejected, withdrawn — points back at the
 * board, where the next one is.
 */
export function MyOffers() {
  const t = useTranslations("listing.bid.myOffers");
  const { data: offers, isLoading, isError, refetch } = useMyOffers();

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <LoadErrorState
        variant="page"
        onRetry={() => void refetch()}
        back={{ href: "/expedion", label: t("browse") }}
      />
    );
  }

  if (!offers || offers.length === 0) {
    return (
      <CenteredEmptyState icon={Gavel} title={t("empty")} description={t("emptyDesc")}>
        <Button asChild>
          {/* The board lives at /expedion. /home is the driver dashboard. */}
          <Link href="/expedion">{t("browse")}</Link>
        </Button>
      </CenteredEmptyState>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/expedion">{t("browse")}</Link>
        </Button>
      </div>

      {offers.map((offer) => (
        <OfferRow key={offer.id} offer={offer} />
      ))}
    </div>
  );
}

function OfferRow({ offer }: { offer: Offer }) {
  const t = useTranslations("listing.bid.myOffers");
  const tCard = useTranslations("listing.bid.offerCard");
  const format = useFormatter();
  const withdraw = useWithdrawOffer();
  const pickup = format.dateTime(new Date(offer.estimatedPickup), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge className={STATUS_TONE[offer.status]}>{t(`status.${offer.status}`)}</Badge>
          <p className="mt-2 font-mono text-lg font-semibold">{euros(offer.priceCents)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Truck className="h-3.5 w-3.5" />
            {t("pickup", { date: pickup })}
            {/* Only the earliest is shown above, so a driver who proposed
                several needs telling the others were kept — otherwise the
                list reads as if the form dropped them. */}
            {offer.slots.length > 1 &&
              ` · ${tCard("otherSlots", { count: offer.slots.length - 1 })}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {offer.status === "pending" || offer.status === "accepted" ? (
            <Button variant="outline" asChild>
              <Link href={`/listing/${offer.listingId}`}>{t("viewJob")}</Link>
            </Button>
          ) : (
            // An expired, rejected or withdrawn bid's job may be gone, back in
            // draft or awarded to someone else: the board is where to go on.
            <Button variant="outline" asChild>
              <Link href="/expedion">{t("findAnother")}</Link>
            </Button>
          )}
          {offer.status === "pending" && (
            <Button
              variant="ghost"
              disabled={withdraw.isPending}
              onClick={() => withdraw.mutate(offer.id)}
            >
              {t("withdraw")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
