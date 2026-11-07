"use client";

import { BackButton } from "@/components/ui/back-button";
import { ActiveShipments } from "@/features/app/driver/ui/ActiveShipments";
import { DriverStats } from "@/features/app/driver/ui/DriverStats";
import { Truck } from "lucide-react";
import { useDriverShipments } from "@/features/app/driver/hooks/useDriverShipments";
import { PageLoader } from "@/components/ui/page-loader";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { useTranslations } from "next-intl";

export default function DriverDashboardPage() {
  const { isLoading, isError, refetch } = useDriverShipments();
  const t = useTranslations("driver.dashboard");

  if (isLoading) {
    return <PageLoader />;
  }

  // The stats and the list below both read this one query: on a failure they
  // would show zero runs, a fact nobody stated (no_dead_ends_spec.md §4).
  if (isError) {
    return <LoadErrorState variant="page" onRetry={() => void refetch()} />;
  }

  return (
    <div className="mx-auto space-y-6 pb-12 md:pb-0">
      <BackButton fallbackHref="/profile" />
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Truck className="w-8 h-8 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stats Overview */}
      <DriverStats />

      {/* Active Shipments Overview */}
      <ActiveShipments />
    </div>
  );
}
