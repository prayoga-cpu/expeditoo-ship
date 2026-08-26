"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Circle, CircleDot } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import type { CompletedTrip } from "../hooks/useCarrierTrips";

const STATUS_STYLES: Record<string, string> = {
  DELIVERED:
    "bg-success/10 text-success border-success/20",
  CANCELLED:
    "bg-destructive/10 text-destructive border-destructive/20",
};

/**
 * One transport carried out, in the shape of the Cocolis reference: status
 * pill and date on top, title and reference on the left, amount on the right,
 * the two endpoints as pins underneath.
 */
export function CompletedTripCard({ trip }: { trip: CompletedTrip }) {
  const t = useTranslations("carrier.trips.completed");
  const { shipment, earnings } = trip;

  const closedAt = shipment.deliveredAt ?? shipment.cancelledAt;
  const amountCents = earnings?.grossCents || shipment.priceCents;

  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <Badge
            variant="outline"
            className={STATUS_STYLES[shipment.status] ?? undefined}
          >
            {t(`status.${shipment.status}`)}
          </Badge>
          {closedAt && (
            <span className="text-sm text-muted-foreground">
              {t("closedOn", { date: format(new Date(closedAt), "dd/MM/yyyy") })}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/deliveries/${shipment.id}`}
              className="font-semibold hover:underline"
            >
              {shipment.listing?.title ?? t("untitled")}
            </Link>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {t("reference", { ref: earnings?.reference ?? shipment.id })}
            </p>
          </div>

          {amountCents !== undefined && (
            <span className="shrink-0 font-mono text-lg font-semibold">
              {formatCurrency(amountCents)}
            </span>
          )}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {earnings?.pickupCity ?? shipment.pickupAddress}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CircleDot className="h-3 w-3 shrink-0 text-primary" />
            <span className="truncate">
              {earnings?.dropoffCity ?? shipment.dropoffAddress}
            </span>
          </div>
        </div>

        {earnings && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            <span>
              {t("commission")}{" "}
              <span className="font-mono">
                {formatCurrency(earnings.commissionCents)}
              </span>
            </span>
            <span>
              {t("net")}{" "}
              <span className="font-mono text-foreground">
                {formatCurrency(earnings.netCents)}
              </span>
            </span>
            {earnings.payoutStatus && (
              <span>{t(`payout.${earnings.payoutStatus}`)}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
