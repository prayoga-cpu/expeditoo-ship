"use client";

import { format } from "date-fns";
import { Truck, Clock, Star, BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Offer } from "../types";

interface OfferCardProps {
  offer: Offer;
  budgetCents: number;
  /** Only the shipper who owns the job may accept. */
  canAccept: boolean;
  isAccepting: boolean;
  isLowest: boolean;
  onAccept: (offerId: string) => void;
}

const euros = formatCurrency;

export function OfferCard({
  offer,
  budgetCents,
  canAccept,
  isAccepting,
  isLowest,
  onAccept,
}: OfferCardProps) {
  // The budget is an expectation, not a cap, so bidding over it is normal and
  // is surfaced rather than treated as an error.
  const overBudget = offer.priceCents > budgetCents;
  const difference = offer.priceCents - budgetCents;

  return (
    <Card
      className={cn(
        "p-4 sm:p-5 transition-colors duration-200",
        offer.status === "accepted" && "border-success ring-1 ring-success/30"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={offer.carrier.image ?? undefined} alt="" />
            <AvatarFallback>
              {offer.carrier.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate">{offer.carrier.name}</p>
              {offer.status === "accepted" && (
                <Badge className="bg-success/15 text-success border-success/30">
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  Selected
                </Badge>
              )}
              {isLowest && offer.status === "pending" && (
                <Badge variant="secondary">Lowest</Badge>
              )}
            </div>

            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              <span className="font-mono">{offer.carrier.rating.toFixed(1)}</span>
            </div>

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Truck className="h-4 w-4 shrink-0" />
                <dd className="truncate">
                  {[offer.vehicle.make, offer.vehicle.model]
                    .filter(Boolean)
                    .join(" ") || offer.vehicle.type.replace(/_/g, " ")}
                </dd>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <dd>
                  Pickup {format(new Date(offer.estimatedPickup), "d MMM, HH:mm")}
                  {" · "}
                  Delivery{" "}
                  {format(new Date(offer.estimatedDelivery), "d MMM, HH:mm")}
                </dd>
              </div>
            </dl>

            {offer.message && (
              <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
                {offer.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
          <div className="text-right">
            <p className="font-mono text-xl font-semibold tabular-nums">
              {euros(offer.priceCents)}
            </p>
            <p
              className={cn(
                "text-xs font-mono",
                overBudget ? "text-warning" : "text-success"
              )}
            >
              {overBudget ? "+" : ""}
              {euros(difference)} vs budget
            </p>
          </div>

          {canAccept && offer.status === "pending" && (
            <Button
              onClick={() => onAccept(offer.id)}
              disabled={isAccepting}
              className="shrink-0"
            >
              {isAccepting ? "Accepting…" : "Accept"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
