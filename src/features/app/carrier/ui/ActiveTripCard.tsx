"use client";

import Link from "next/link";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { ListingReference } from "@/features/app/listing/ui/ListingReference";
import { ShipmentStatusBadge } from "@/features/app/deliveries/ui/ShipmentStatusBadge";
import type { ActiveTrip } from "../hooks/useCarrierTrips";
import { TripEndpoints } from "./TripEndpoints";

/**
 * « Enlèvement prévu … », or nothing for a run with no date on it.
 * `scheduledPickup` is the slot the award booked (`estimatedPickup` copied at
 * award); the offer's own value stands in where the column is null.
 */
function usePickupLabel(trip: ActiveTrip): string | null {
  const t = useTranslations("carrier.trips.active");
  const dateLocale = useLocale() === "fr" ? fr : enUS;
  const pickupAt = trip.scheduledPickup ?? trip.offer?.estimatedPickup ?? null;

  if (!pickupAt) return null;
  const date = format(new Date(pickupAt), "EEE d MMM, HH:mm", { locale: dateLocale });
  return t("pickupOn", { date });
}

/**
 * One run awarded and not finished, in the shape of the « Terminés » cards.
 *
 * The pill is `ShipmentStatusBadge`, so it reads in the client's vocabulary
 * (« En préparation », « En retrait », « En cours de livraison ») exactly as
 * `/deliveries` does — the whole card opens that run's page.
 */
export function ActiveTripCard({ trip }: { trip: ActiveTrip }) {
  const t = useTranslations("carrier.trips");
  const pickupLabel = usePickupLabel(trip);
  const priceCents = trip.priceCents ?? trip.offer?.priceCents;

  return (
    <Link href={`/deliveries/${trip.id}`} className="block">
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ShipmentStatusBadge status={trip.status} />
            {pickupLabel && (
              <span className="text-sm text-muted-foreground">{pickupLabel}</span>
            )}
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold">{trip.listing?.title ?? t("untitledJob")}</p>
              {trip.listing && (
                <div>
                  <ListingReference reference={trip.listing.reference} from={trip.listing.pickupCity} to={trip.listing.dropoffCity} />
                </div>
              )}
            </div>

            {priceCents !== undefined && (
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{t("active.agreedPrice")}</p>
                <p className="font-mono text-lg font-semibold">
                  {formatCurrency(priceCents)}
                </p>
              </div>
            )}
          </div>

          <TripEndpoints
            from={trip.listing?.pickupCity ?? trip.pickupAddress}
            to={trip.listing?.dropoffCity ?? trip.dropoffAddress}
          />
        </CardContent>
      </Card>
    </Link>
  );
}
