"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarClock, Gavel, MapPin, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { listingsApi } from "@/features/app/listing/api/listings.api";
import { ListingReference } from "@/features/app/listing/ui/ListingReference";
import { UrgencyBadge } from "@/features/app/listing/ui/UrgencyBadge";
import type { Job } from "@/features/app/listing/types";
import { formatCurrency } from "@/lib/currency";

const euros = (cents: number) => formatCurrency(cents, { fractionDigits: 0 });

/**
 * Split the open jobs into the two lists the page shows.
 *
 * **To award** is the operator's own work: escalated Expedion jobs with at
 * least one bid. Their owner is a system account nobody signs into, so an
 * operator chooses in the client's place.
 *
 * **Waiting for a driver** is every other open job: escalated jobs nobody has
 * bid on yet, and direct requests. A direct request is the requester's to
 * award — they pay with their own card in the accept dialog, 3-D Secure
 * included — so the operator follows it here rather than awarding it
 * (client_feedback_2026_10_21_spec.md §B1).
 */
export function splitAwardQueue(expedion: Job[], direct: Job[]) {
  const toAward = expedion.filter((job) => (job.offersCount ?? 0) > 0);
  const waiting = [
    ...expedion.filter((job) => (job.offersCount ?? 0) === 0),
    ...direct,
  ].sort(
    (a, b) => new Date(a.pickupFrom).getTime() - new Date(b.pickupFrom).getTime()
  );
  return { toAward, waiting };
}

export function AwardQueue() {
  const t = useTranslations("admin.awards");

  // Two reads rather than one: the board caps a page at fifty, and a busy day
  // of direct requests must not push an escalated job out of the first list.
  // `browse` already restricts both to open, unexpired jobs.
  const expedion = useQuery({
    queryKey: ["admin", "award-queue", "expedion"],
    queryFn: () =>
      listingsApi.browse({ origin: "expedion", sort: "pickup_asc", limit: 50 }),
  });
  const direct = useQuery({
    queryKey: ["admin", "award-queue", "direct"],
    queryFn: () =>
      listingsApi.browse({ origin: "direct", sort: "pickup_asc", limit: 50 }),
  });

  if (expedion.isLoading || direct.isLoading) return <PageLoader />;

  if (expedion.isError || direct.isError) {
    return (
      <CenteredEmptyState
        icon={Gavel}
        title={t("error.title")}
        description={t("error.description")}
      />
    );
  }

  const { toAward, waiting } = splitAwardQueue(
    expedion.data?.items ?? [],
    direct.data?.items ?? []
  );

  if (toAward.length === 0 && waiting.length === 0) {
    return (
      <CenteredEmptyState
        icon={Gavel}
        title={t("empty.title")}
        description={t("empty.description")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </header>

      <section className="space-y-3" aria-labelledby="awards-to-award">
        <div className="space-y-0.5">
          <h2 id="awards-to-award" className="font-semibold">
            {t("toAward.title", { count: toAward.length })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("toAward.description")}
          </p>
        </div>
        {toAward.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {t("toAward.empty")}
          </p>
        ) : (
          toAward.map((job) => <QueueCard key={job.id} job={job} />)
        )}
      </section>

      <section className="space-y-3" aria-labelledby="awards-waiting">
        <div className="space-y-0.5">
          <h2 id="awards-waiting" className="font-semibold">
            {t("waiting.title", { count: waiting.length })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("waiting.description")}
          </p>
        </div>
        {waiting.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {t("waiting.empty")}
          </p>
        ) : (
          waiting.map((job) => <QueueCard key={job.id} job={job} />)
        )}
      </section>
    </div>
  );
}

function QueueCard({ job }: { job: Job }) {
  const t = useTranslations("admin.awards");
  const format = useFormatter();
  const bids = job.offersCount ?? 0;
  const isDirect = job.origin === "direct";

  return (
    <Link href={`/listing/${job.id}`} className="block">
      <Card className="gap-1.5 p-4 transition-colors hover:bg-muted/50">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {job.title}
              <UrgencyBadge job={job} />
            </p>
            <ListingReference reference={job.reference} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">
              {isDirect ? t("decider.requester") : t("decider.operator")}
            </Badge>
            <Badge variant={bids > 0 ? "secondary" : "outline"} className="gap-1">
              <Gavel className="h-3 w-3" aria-hidden />
              {bids > 0 ? t("bidCount", { count: bids }) : t("noBids")}
            </Badge>
          </div>
        </div>

        <p className="flex items-center gap-1 text-sm break-words text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {job.pickupCity} → {job.dropoffCity}
        </p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("pickup", {
            date: format.dateTime(new Date(job.pickupFrom), {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
        {isDirect && job.shipper?.name ? (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {job.shipper.name}
          </p>
        ) : null}

        <p className="mt-1 font-mono text-sm tabular-nums">
          {isDirect ? t("budget") : t("clientPaid")}: {euros(job.budgetCents)}
        </p>
        {/* An operator recommends on a direct request; the requester pays to
            confirm (client_feedback_2026_10_29_spec.md §B1). */}
        {isDirect && bids > 0 ? (
          <p className="text-xs text-primary">{t("proposeHint")}</p>
        ) : null}
      </Card>
    </Link>
  );
}
