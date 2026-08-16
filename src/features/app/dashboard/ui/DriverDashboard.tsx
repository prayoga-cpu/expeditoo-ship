"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, FileText, Gavel, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { ApplicationStatusBanner } from "@/features/app/carrier/ui";
import { useDriverDashboard } from "../hooks/useDriverDashboard";
import type { Shipment } from "@/features/app/deliveries/api/deliveries.api";

/**
 * A single number with somewhere to go. Whole tile is the link, so the target
 * is reachable by tapping anywhere on it rather than only the label.
 */
function StatTile({
  href,
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  href: string;
  label: string;
  value: number;
  icon: typeof Package;
  isLoading: boolean;
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full p-4 transition-colors hover:bg-muted/50">
        <div className="flex items-start justify-between gap-2">
          <Icon className="h-5 w-5 text-primary" aria-hidden />
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <p className="mt-3 font-mono text-2xl leading-none font-semibold tabular-nums">
          {isLoading ? "—" : value}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </Card>
    </Link>
  );
}

/** The run the driver is physically doing, if there is one. */
function CurrentRunCard({ run }: { run: Shipment }) {
  const t = useTranslations("dashboard");

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="font-semibold">{t("currentRun.title")}</h2>
      </div>

      <p className="mt-3 font-medium">
        {run.listing?.title ?? t("currentRun.untitled")}
      </p>

      {/* Route, wrapped rather than truncated: an address the driver cannot
          read in full is worse than one that takes two lines. */}
      <p className="mt-1 text-sm break-words text-muted-foreground">
        {run.pickupAddress} → {run.dropoffAddress}
      </p>

      <Button asChild className="mt-4 w-full sm:w-auto">
        <Link href={`/deliveries/${run.id}`}>{t("currentRun.action")}</Link>
      </Button>
    </Card>
  );
}

/**
 * The driver's home screen.
 *
 * Replaces the job board that used to sit here. The board moved to /expedion
 * when Expedion escalation became the only inlet — a driver arriving at the app
 * needs to know where they stand before they need a list of work: whether they
 * are approved, what they are currently carrying, and what is waiting.
 */
export function DriverDashboard() {
  const t = useTranslations("dashboard");
  const {
    application,
    isApplicationLoading,
    isApproved,
    openJobCount,
    isOpenJobsLoading,
    liveOfferCount,
    isOffersLoading,
    activeRuns,
    currentRun,
    isRunsLoading,
  } = useDriverDashboard();

  if (isApplicationLoading) return <PageLoader />;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {application && <ApplicationStatusBanner application={application} />}

      {/* No application at all: the only thing worth offering is the way in. */}
      {!application && (
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="font-semibold">{t("getStarted.title")}</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("getStarted.description")}
          </p>
          <Button asChild className="mt-4 w-full sm:w-auto">
            <Link href="/carrier/application">{t("getStarted.action")}</Link>
          </Button>
        </Card>
      )}

      {currentRun && <CurrentRunCard run={currentRun} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          href="/expedion"
          label={t("stats.openJobs")}
          value={openJobCount}
          icon={Package}
          isLoading={isOpenJobsLoading}
        />
        <StatTile
          href="/deliveries"
          label={t("stats.activeRuns")}
          value={activeRuns.length}
          icon={Truck}
          isLoading={isRunsLoading}
        />
        {/* Only meaningful once approved — before that the query is disabled
            and the tile would sit permanently at zero. */}
        {isApproved && (
          <StatTile
            href="/carrier/offers"
            label={t("stats.liveOffers")}
            value={liveOfferCount}
            icon={Gavel}
            isLoading={isOffersLoading}
          />
        )}
      </div>
    </div>
  );
}
