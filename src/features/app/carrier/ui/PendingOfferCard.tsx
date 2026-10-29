"use client";

import Link from "next/link";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { parseDayString } from "@/lib/availability-window";
import { ListingReference } from "@/features/app/listing/ui/ListingReference";
import type { PendingOffer } from "../hooks/useCarrierTrips";
import { TripEndpoints } from "./TripEndpoints";
import { CounterResponse } from "./CounterResponse";

interface PendingOfferCardProps {
  offer: PendingOffer;
  isWithdrawing: boolean;
  onWithdraw: (offer: PendingOffer) => void;
}

/**
 * The earliest slot the carrier proposed, in the words the requester reads it
 * in (`OfferCard`). Slots arrive earliest first (`slotsEarliestFirst`).
 *
 * From the driver's own `day` string rather than the instant, for the reason
 * `OfferCard` gives: the instant renders in the viewer's timezone. An offer
 * with no slot took the job's own window, so its stored instant is all there is.
 */
function useEarliestPickup(offer: PendingOffer): string {
  const t = useTranslations("listing.bid.offerCard");
  const dateLocale = useLocale() === "fr" ? fr : enUS;
  const earliest = offer.slots[0];

  if (!earliest) {
    return format(new Date(offer.estimatedPickup), "d MMM, HH:mm", {
      locale: dateLocale,
    });
  }

  const day = format(parseDayString(earliest.day), "EEE d MMM", {
    locale: dateLocale,
  });
  return t("slotLine", { day, period: t(`slot.${earliest.slot}`) });
}

function EarliestPickupLine({ offer }: { offer: PendingOffer }) {
  const t = useTranslations("carrier.trips.pending");
  const slots = useTranslations("listing.bid.offerCard");
  const pickup = useEarliestPickup(offer);

  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {t("earliestPickup", { pickup })}
        {/* Only the earliest is named, so the others need saying, or the card
            reads as if the form dropped them. */}
        {offer.slots.length > 1 &&
          ` · ${slots("otherSlots", { count: offer.slots.length - 1 })}`}
      </span>
    </p>
  );
}

/**
 * One bid still waiting on the requester or an operator, in the shape of the
 * « Terminés » cards: the job and its reference, the price offered, the two
 * cities, the earliest pickup proposed — then the way to the job and the way
 * out of the bid.
 */
export function PendingOfferCard({
  offer,
  isWithdrawing,
  onWithdraw,
}: PendingOfferCardProps) {
  const t = useTranslations("carrier.trips");
  const { listing } = offer;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold">{listing?.title ?? t("untitledJob")}</p>
            {listing && (
              <div>
                <ListingReference reference={listing.reference} />
              </div>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">{t("pending.yourPrice")}</p>
            <p className="font-mono text-lg font-semibold">
              {formatCurrency(offer.priceCents)}
            </p>
          </div>
        </div>

        {listing && <TripEndpoints from={listing.pickupCity} to={listing.dropoffCity} />}

        <EarliestPickupLine offer={offer} />

        <CounterResponse offer={offer} />

        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={isWithdrawing}
            onClick={() => onWithdraw(offer)}
          >
            {t("pending.withdraw")}
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/listing/${offer.listingId}`}>{t("pending.view")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
