"use client";

import { useTranslations } from "next-intl";
import { Truck } from "lucide-react";

import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { useActiveTrips } from "../hooks/useCarrierTrips";
import { ActiveTripCard } from "./ActiveTripCard";
import { TripsLoadError } from "./TripsLoadError";

/**
 * « En transit »: the runs awarded to the carrier that are not finished —
 * `PENDING`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT` — each opening its
 * `/deliveries/[id]` page (client_feedback_2026_10_spec.md §5).
 */
export function ActiveTripsPanel() {
  const t = useTranslations("carrier.trips.active");
  const { trips, isLoading, isError, refetch } = useActiveTrips();

  if (isLoading) return <PageLoader className="xl:min-h-[50vh]" />;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      {isError ? (
        <TripsLoadError onRetry={() => void refetch()} />
      ) : trips.length === 0 ? (
        <CenteredEmptyState
          icon={Truck}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <div className="grid gap-3">
          {trips.map((trip) => (
            <ActiveTripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}
