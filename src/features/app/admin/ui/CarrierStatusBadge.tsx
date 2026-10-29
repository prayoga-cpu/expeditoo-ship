"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { CarrierApplicationStatus } from "../api/carriers.api";

// Solid fills with white text read correctly in both light and dark theme.
const STATUS_STYLES: Record<CarrierApplicationStatus, string> = {
  draft: "bg-muted text-muted-foreground hover:bg-muted",
  submitted: "bg-orange-500 hover:bg-orange-600 text-white",
  under_review: "bg-blue-500 hover:bg-blue-600 text-white",
  approved: "bg-green-500 hover:bg-green-600 text-white",
  rejected: "bg-red-500 hover:bg-red-600 text-white",
  suspended: "bg-slate-600 hover:bg-slate-700 text-white",
  deregistered: "bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-700",
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
      <Badge className="bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600">
        {t("absent")}
      </Badge>
    );
  }
  return <Badge className={STATUS_STYLES[status]}>{t(status)}</Badge>;
}
