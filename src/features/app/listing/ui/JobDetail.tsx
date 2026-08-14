"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Package,
  MapPin,
  CalendarClock,
  Inbox,
  AlertTriangle,
  HandHelping,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import { useJobDetail, useJobOffers, useAcceptOffer } from "../hooks/useJobDetail";
import { JobBidSection } from "./JobBidSection";
import { OfferCard } from "./OfferCard";
import type { Job } from "../types";

interface JobDetailProps {
  listingId: string;
  /** Null when signed out; drives whether offers are visible at all. */
  viewerId: string | null;
}

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

const STATUS_TONE: Record<string, string> = {
  open: "bg-success/15 text-success border-success/30",
  awarded: "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-warning/15 text-warning border-warning/30",
  draft: "bg-muted text-muted-foreground border-border",
};

export function JobDetail({ listingId, viewerId }: JobDetailProps) {
  const [sort, setSort] = useState("price_asc");

  const { data: job, isLoading } = useJobDetail(listingId);
  const { data: offers } = useJobOffers(listingId, sort);
  const acceptOffer = useAcceptOffer(listingId);

  if (isLoading || !job) return <PageLoader />;

  const isShipper = viewerId !== null && job.shipperId === viewerId;
  const canAccept = isShipper && job.status === "open";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={STATUS_TONE[job.status]}>
            {job.status.replace(/_/g, " ")}
          </Badge>
          {job.origin === "expedion" && (
            <Badge variant="secondary">via Expedion</Badge>
          )}
          {job.isFragile && (
            <Badge variant="outline">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Fragile
            </Badge>
          )}
          {job.needsHelp && (
            <Badge variant="outline">
              <HandHelping className="mr-1 h-3 w-3" />
              Help loading
            </Badge>
          )}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {job.title}
        </h1>

        <p className="font-mono text-lg text-muted-foreground">
          Budget {euros(job.budgetCents)}
        </p>
      </header>

      <JobRoute job={job} />

      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Package className="h-4 w-4 text-muted-foreground" />
          Load
        </h2>
        <Separator />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Detail label="Weight" value={`${job.weightKg} kg`} />
          <Detail label="Quantity" value={String(job.quantity)} />
          {job.lengthCm && job.widthCm && job.heightCm && (
            <Detail
              label="Dimensions"
              value={`${job.lengthCm} × ${job.widthCm} × ${job.heightCm} cm`}
            />
          )}
        </dl>
        <p className="text-sm leading-relaxed text-foreground/80">
          {job.description}
        </p>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Offers{" "}
            <span className="font-mono text-muted-foreground">
              ({job.offersCount})
            </span>
          </h2>

          {offers?.scope === "full" && offers.offers.length > 1 && (
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
                <SelectItem value="rating_desc">Best rated</SelectItem>
                <SelectItem value="pickup_asc">Earliest pickup</SelectItem>
                <SelectItem value="created_desc">Newest</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <OfferSection
          offers={offers}
          job={job}
          canAccept={canAccept}
          isAccepting={acceptOffer.isPending}
          onAccept={(id) => acceptOffer.mutate(id)}
        />
      </section>

      <JobBidSection job={job} viewerId={viewerId} />
    </div>
  );
}

function JobRoute({ job }: { job: Job }) {
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        Route
      </h2>
      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <Endpoint
          title="Pickup"
          address={job.pickupAddress}
          city={`${job.pickupPostalCode} ${job.pickupCity}`}
          locationType={job.pickupLocationType}
          from={job.pickupFrom}
          until={job.pickupUntil}
        />
        <Endpoint
          title="Dropoff"
          address={job.dropoffAddress}
          city={`${job.dropoffPostalCode} ${job.dropoffCity}`}
          locationType={job.dropoffLocationType}
          from={job.dropoffFrom}
          until={job.dropoffUntil}
        />
      </div>

      {job.isFlexible && (
        <p className="text-sm text-muted-foreground">
          Dates are flexible — carriers may propose times outside these windows.
        </p>
      )}
    </Card>
  );
}

function Endpoint({
  title,
  address,
  city,
  locationType,
  from,
  until,
}: {
  title: string;
  address: string;
  city: string;
  locationType: string;
  from: string;
  until: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="font-medium">{address}</p>
      <p className="text-sm text-muted-foreground">{city}</p>
      <Badge variant="outline" className="mt-1">
        {locationType.replace(/_/g, " ")}
      </Badge>
      <p className="flex items-center gap-1.5 pt-1 text-sm text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        {format(new Date(from), "d MMM HH:mm")} –{" "}
        {format(new Date(until), "d MMM HH:mm")}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

/**
 * Renders whichever view the API granted. The scopes are the service's
 * decision, not the component's - a non-participant is never sent the offers
 * to hide (offers_engine_spec.md §6).
 */
function OfferSection({
  offers,
  job,
  canAccept,
  isAccepting,
  onAccept,
}: {
  offers: ReturnType<typeof useJobOffers>["data"];
  job: Job;
  canAccept: boolean;
  isAccepting: boolean;
  onAccept: (id: string) => void;
}) {
  if (!offers) return null;

  if (offers.scope === "aggregate") {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">
          {offers.offersCount === 0
            ? "No offers yet."
            : `${offers.offersCount} carrier${offers.offersCount > 1 ? "s have" : " has"} bid on this job.`}
        </p>
        {offers.lowestPriceCents !== null && (
          <p className="mt-1 font-mono text-lg">
            from {euros(offers.lowestPriceCents)}
          </p>
        )}
      </Card>
    );
  }

  if (offers.offers.length === 0) {
    return (
      <CenteredEmptyState
        icon={Inbox}
        title="No offers yet"
        description="Carriers are notified when a job goes live. Offers usually start arriving within a few hours."
      />
    );
  }

  const lowest = Math.min(...offers.offers.map((o) => o.priceCents));

  return (
    <div className="space-y-3">
      {offers.offers.map((offer) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          budgetCents={job.budgetCents}
          canAccept={canAccept}
          isAccepting={isAccepting}
          isLowest={offer.priceCents === lowest}
          onAccept={onAccept}
        />
      ))}
    </div>
  );
}
