"use client";

import { format } from "date-fns";
import { Gavel, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import Link from "next/link";
import { useMyOffers, useWithdrawOffer } from "../hooks/useCarrierOffers";
import type { OfferStatus } from "@/features/app/listing/types";
import { formatCurrency } from "@/lib/currency";

const euros = formatCurrency;

const STATUS_TONE: Record<OfferStatus, string> = {
  pending: "bg-primary/10 text-primary border-primary/30",
  accepted: "bg-success/15 text-success border-success/30",
  rejected: "bg-muted text-muted-foreground border-border",
  withdrawn: "bg-muted text-muted-foreground border-border",
  expired: "bg-warning/15 text-warning border-warning/30",
};

/** The carrier's own bids across every job. */
export function MyOffers() {
  const { data: offers, isLoading } = useMyOffers();
  const withdraw = useWithdrawOffer();

  if (isLoading) return <PageLoader />;

  if (!offers || offers.length === 0) {
    return (
      <CenteredEmptyState
        icon={Gavel}
        title="No offers yet"
        description="Browse open jobs and bid on the ones that fit your routes."
      >
        <Button asChild>
          {/* The board lives at /expedion. /home is the driver dashboard. */}
          <Link href="/expedion">Browse jobs</Link>
        </Button>
      </CenteredEmptyState>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">My offers</h1>

      {offers.map((offer) => (
        <Card key={offer.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge className={STATUS_TONE[offer.status]}>{offer.status}</Badge>
              <p className="mt-2 font-mono text-lg font-semibold">
                {euros(offer.priceCents)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Truck className="h-3.5 w-3.5" />
                Pickup {format(new Date(offer.estimatedPickup), "d MMM HH:mm")}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href={`/listing/${offer.listingId}`}>View job</Link>
              </Button>
              {offer.status === "pending" && (
                <Button
                  variant="ghost"
                  disabled={withdraw.isPending}
                  onClick={() => withdraw.mutate(offer.id)}
                >
                  Withdraw
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
