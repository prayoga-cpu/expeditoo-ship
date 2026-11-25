"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { CalendarClock, HandCoins, MapPin, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { isRefusal } from "@/lib/fetcher";
import { PageLoader } from "@/components/ui/page-loader";
import Link from "next/link";
import { useMyOffers, useWithdrawOffer } from "../hooks/useCarrierOffers";
import { ListingReference } from "@/features/app/listing/ui/ListingReference";
import type { Offer, OfferListing, OfferStatus } from "@/features/app/listing/types";
import { DEFAULT_COUNTRY, countryName } from "@/lib/countries";
import { formatCurrency } from "@/lib/currency";

const euros = formatCurrency;

const STATUS_TONE: Record<OfferStatus, string> = {
  pending: "bg-primary/10 text-primary border-primary/30",
  accepted: "tone-success",
  rejected: "bg-muted text-muted-foreground border-border",
  withdrawn: "bg-muted text-muted-foreground border-border",
  expired: "tone-warning",
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
  const { data: offers, isLoading, isError, error, refetch } = useMyOffers();

  if (isLoading) return <PageLoader />;

  // Not a carrier (yet, or any more): « try again » cannot help, the
  // application can (2.77.1).
  if (isError && isRefusal(error)) {
    return (
      <CenteredEmptyState
        icon={HandCoins}
        title={t("notCarrier")}
        description={t("notCarrierDesc")}
      >
        <Button asChild>
          <Link href="/carrier/application">{t("application")}</Link>
        </Button>
      </CenteredEmptyState>
    );
  }

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
      <CenteredEmptyState icon={HandCoins} title={t("empty")} description={t("emptyDesc")}>
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

const DAY = { day: "numeric", month: "short" } as const;

/** « Bruxelles (Belgique) » — the country only when it is not the home one. */
function town(city: string, country: string | undefined, locale: string) {
  if (!country || country === DEFAULT_COUNTRY) return city;
  return `${city} (${countryName(country, locale)})`;
}

/**
 * What the bid is *on*: the job's title, its number, its two towns and the
 * dates the requester asked for. The list showed a status, a price and the
 * driver's own slot, so three pending bids were three prices with nothing to
 * tell them apart (client feedback, 2.91.0 #24).
 */
function OfferJob({ listing }: { listing: OfferListing }) {
  const t = useTranslations("listing.bid.myOffers");
  const format = useFormatter();
  const locale = useLocale();
  const range = (from: string, until: string) =>
    format.dateTimeRange(new Date(from), new Date(until), DAY);

  return (
    <div className="space-y-1">
      <p className="font-medium break-words">{listing.title}</p>
      <p className="flex items-start gap-1.5 text-sm">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 break-words">
          {town(listing.pickupCity, listing.pickupCountry, locale)} →{" "}
          {town(listing.dropoffCity, listing.dropoffCountry, locale)}
        </span>
      </p>
      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="font-medium text-foreground">{t("jobDates")}</span>{" "}
          {t("jobPickup", { dates: range(listing.pickupFrom, listing.pickupUntil) })}
          {" · "}
          {t("jobDelivery", { dates: range(listing.dropoffFrom, listing.dropoffUntil) })}
        </span>
      </p>
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
    <Card className="p-4" data-testid="my-offer">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge className={STATUS_TONE[offer.status]}>{t(`status.${offer.status}`)}</Badge>
            {offer.listing && <ListingReference reference={offer.listing.reference} />}
          </div>
          {offer.listing ? (
            <OfferJob listing={offer.listing} />
          ) : (
            // The row outlived its job. The bid is still the driver's record,
            // so it stays — and says why it names nothing.
            <p className="text-sm text-muted-foreground">{t("jobUnavailable")}</p>
          )}
          <p className="font-mono text-lg font-semibold">{euros(offer.priceCents)}</p>
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="font-medium text-foreground">{t("yourSlot")}</span>{" "}
              {t("slotPickup", { date: pickup })}
              {/* Only the earliest is shown above, so a driver who proposed
                  several needs telling the others were kept — otherwise the
                  list reads as if the form dropped them. */}
              {offer.slots.length > 1 &&
                ` · ${tCard("otherSlots", { count: offer.slots.length - 1 })}`}
            </span>
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
