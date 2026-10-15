"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";

/**
 * What every « Mes trajets » tab shows when its list could not be read: a
 * failure said out loud, with a way to try again. A list that rendered as
 * empty on error would tell a carrier they have no bids or no runs when they
 * do (CLAUDE.md gotcha 9).
 */
export function TripsLoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("carrier.trips.loadError");

  return (
    <CenteredEmptyState
      icon={AlertTriangle}
      title={t("title")}
      description={t("description")}
    >
      <Button variant="outline" onClick={onRetry}>
        {t("retry")}
      </Button>
    </CenteredEmptyState>
  );
}
