"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Package, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { formatCurrency } from "@/lib/currency";
import { periodBounds, type PeriodKey } from "@/lib/statement-period";
import { useCompletedTrips, type CompletedTrip } from "../hooks/useCarrierTrips";
import { earningsStatementUrl } from "../api/trips.api";
import { CompletedTripCard } from "./CompletedTripCard";

const iso = (date?: Date) => date?.toISOString();

function matchesSearch(trip: CompletedTrip, term: string) {
  if (!term) return true;
  const needle = term.toLowerCase();

  return [
    trip.shipment.listing?.title,
    trip.shipment.id,
    trip.earnings?.reference,
    trip.shipment.pickupAddress,
    trip.shipment.dropoffAddress,
  ]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle));
}

function withinPeriod(trip: CompletedTrip, bounds: { from?: Date; to?: Date }) {
  const stamp =
    trip.shipment.deliveredAt ??
    trip.shipment.cancelledAt ??
    trip.shipment.updatedAt;
  const at = new Date(stamp);

  if (bounds.from && at < bounds.from) return false;
  if (bounds.to && at > bounds.to) return false;
  return true;
}

/**
 * The transports actually carried out, laid out like the Cocolis "Mes
 * paiements" reference the client sent: search, period, a period download, and
 * one card per run carrying its status, reference, amount and endpoints.
 */
export function CompletedTripsPanel() {
  const t = useTranslations("carrier.trips.completed");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("all");

  const bounds = useMemo(() => periodBounds(period), [period]);
  const { trips, summary, commissionRetainsAll, isLoading } = useCompletedTrips({
    from: iso(bounds.from),
    to: iso(bounds.to),
  });

  const visible = useMemo(
    () =>
      trips
        .filter((trip) => withinPeriod(trip, bounds))
        .filter((trip) => matchesSearch(trip, search.trim())),
    [trips, bounds, search]
  );

  if (isLoading) return <PageLoader className="xl:min-h-[50vh]" />;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <Select
          value={period}
          onValueChange={(value) => setPeriod(value as PeriodKey)}
        >
          <SelectTrigger className="md:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("periods.all")}</SelectItem>
            <SelectItem value="this_month">{t("periods.thisMonth")}</SelectItem>
            <SelectItem value="last_month">{t("periods.lastMonth")}</SelectItem>
            <SelectItem value="this_year">{t("periods.thisYear")}</SelectItem>
          </SelectContent>
        </Select>

        <Button asChild variant="outline">
          <a
            href={earningsStatementUrl({
              from: iso(bounds.from),
              to: iso(bounds.to),
            })}
          >
            <FileText className="h-4 w-4" />
            {t("downloadStatement")}
          </a>
        </Button>
      </div>

      {summary && <EarningsSummaryCard summary={summary} muted={commissionRetainsAll} />}

      {visible.length === 0 ? (
        <CenteredEmptyState
          icon={Package}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <div className="grid gap-3">
          {visible.map((trip) => (
            <CompletedTripCard key={trip.shipment.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}

function EarningsSummaryCard({
  summary,
  muted,
}: {
  summary: {
    deliveries: number;
    grossCents: number;
    commissionCents: number;
    netCents: number;
  };
  muted: boolean;
}) {
  const t = useTranslations("carrier.trips.completed");

  const figures = [
    { key: "deliveries", value: String(summary.deliveries) },
    { key: "gross", value: formatCurrency(summary.grossCents) },
    { key: "commission", value: formatCurrency(summary.commissionCents) },
    { key: "net", value: formatCurrency(summary.netCents) },
  ];

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {figures.map((figure) => (
            <div key={figure.key}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t(`summary.${figure.key}`)}
              </p>
              <p className="font-mono text-lg font-semibold">{figure.value}</p>
            </div>
          ))}
        </div>

        {/* The net reads zero by decision, not by defect — say so rather than
            letting the carrier guess (billing_documents_spec.md §2). */}
        {muted && (
          <p className="rounded-md bg-warning/10 p-3 text-xs text-warning-foreground">
            {t("summary.commissionNotice")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
