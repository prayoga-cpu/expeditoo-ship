"use client";

import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { PageLoader } from "@/components/ui/page-loader";
import { useDeliveryHistory } from "../hooks/useMyRequests";
import { DeliveredRequestCard } from "./DeliveredRequestCard";

/**
 * What was actually delivered, newest first, each entry naming its
 * transporter (my_requests_history_spec.md §7.3).
 */
export function DeliveryHistoryPanel() {
  const t = useTranslations("myJobs.history");
  const next = useTranslations("common.nextSteps");
  const { deliveries, isLoading, isError, refetch } = useDeliveryHistory();

  if (isLoading) return <PageLoader />;

  // A query hook that renders nothing on failure is how the withdrawals 500
  // stayed invisible for a week (CLAUDE.md gotcha 9).
  if (isError) {
    return (
      <LoadErrorState variant="page" title={t("loadFailed")} onRetry={() => void refetch()} />
    );
  }

  if (deliveries.length === 0) {
    return (
      <CenteredEmptyState
        variant="page"
        icon={PackageCheck}
        title={t("empty")}
        description={t("emptyDesc")}
      >
        <Button asChild variant="outline">
          <Link href="/listings/me">{next("myRequests")}</Link>
        </Button>
      </CenteredEmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("count", { count: deliveries.length })}
      </p>
      {deliveries.map((entry) => (
        <DeliveredRequestCard
          key={entry.delivery.shipmentId}
          job={entry.job}
          delivery={entry.delivery}
        />
      ))}
    </div>
  );
}
