import Link from "next/link";
import { MapPin, Clock, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { ShipmentStatusBadge } from "./ShipmentStatusBadge";
import type { DeliverySummaryView } from "../types";

/**
 * One shipment in the tracking list. Pure presentation - the view model is
 * built by useDeliveries.
 */
export function DeliveryCard({ delivery }: { delivery: DeliverySummaryView }) {
  return (
    <Link href={`/deliveries/${delivery.id}`} className="block">
      <Card className="group cursor-pointer p-4 transition-colors hover:border-primary/40 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold text-foreground group-hover:text-primary">
              {delivery.title}
            </h3>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {delivery.pickupAddress} → {delivery.dropoffAddress}
              </span>
            </p>
          </div>

          {delivery.priceCents !== undefined && (
            <p className="shrink-0 font-mono text-lg font-semibold">
              {formatCurrency(delivery.priceCents)}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <ShipmentStatusBadge status={delivery.status} />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {delivery.counterpartName}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {delivery.dateLabel}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
