"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Gavel, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { listingsApi } from "@/features/app/listing/api/listings.api";

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);

/**
 * Escalated Expedion jobs waiting for someone to pick a winner.
 *
 * These jobs are owned by a system account nobody signs into, so the shipper
 * who would normally choose does not exist — an operator chooses in the
 * client's place. Sorted by pickup date because the job collecting soonest is
 * the one where a late award actually costs something.
 *
 * Awarding happens on the job page itself rather than here: that screen already
 * compares offers and is permission-aware, so duplicating it would mean two
 * accept paths to keep in step.
 */
export function AwardQueue() {
  const t = useTranslations("admin.awards");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "award-queue"],
    queryFn: () =>
      listingsApi.browse({
        origin: "expedion",
        sort: "pickup_asc",
        limit: 50,
      }),
  });

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <CenteredEmptyState
        icon={Gavel}
        title={t("error.title")}
        description={t("error.description")}
      />
    );
  }

  // `browse` already restricts to open, unexpired jobs. What it cannot filter
  // on is whether anyone has bid, and a job with no offers has nothing to
  // award — showing it would make the queue look like work that is not there.
  const awaiting = (data?.items ?? []).filter((job) => (job.offersCount ?? 0) > 0);

  if (awaiting.length === 0) {
    return (
      <CenteredEmptyState
        icon={Gavel}
        title={t("empty.title")}
        description={t("empty.description")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle", { count: awaiting.length })}
        </p>
      </header>

      <div className="space-y-3">
        {awaiting.map((job) => (
          <Link key={job.id} href={`/listing/${job.id}`} className="block">
            <Card className="p-4 transition-colors hover:bg-muted/50">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{job.title}</p>
                <Badge variant="secondary" className="gap-1">
                  <Gavel className="h-3 w-3" aria-hidden />
                  {t("bidCount", { count: job.offersCount ?? 0 })}
                </Badge>
              </div>

              <p className="mt-1 flex items-center gap-1 text-sm break-words text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {job.pickupCity} → {job.dropoffCity}
              </p>

              <p className="mt-2 font-mono text-sm tabular-nums">
                {t("clientPaid")}: {euros(job.budgetCents)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
