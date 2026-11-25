"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { CarrierApplicationStatus } from "../api/carriers.api";

// Solid fills with white text read correctly in both light and dark theme.
const STATUS_STYLES: Record<CarrierApplicationStatus, string> = {
  draft: "bg-muted text-muted-foreground hover:bg-muted",
  submitted: "tone-warning",
  under_review: "tone-info",
  approved: "tone-success",
  rejected: "tone-danger",
  suspended: "tone-neutral",
  deregistered: "tone-neutral",
};

/**
 * The driver's standing in the field test's four words
 * (client_feedback_2026_10_29_spec.md §REQ-02): an approved driver reads
 * « Actif », or « Absent » while away — absence is not a status of its own.
 */
export function CarrierStatusBadge({
  status,
  absent = false,
}: {
  status: CarrierApplicationStatus;
  absent?: boolean;
}) {
  const t = useTranslations("admin.carriers.status");

  if (status === "approved" && absent) {
    return (
      <Badge variant="outline" className="tone-warning">
        {t("absent")}
      </Badge>
    );
  }
  return <Badge variant="outline" className={STATUS_STYLES[status]}>{t(status)}</Badge>;
}
