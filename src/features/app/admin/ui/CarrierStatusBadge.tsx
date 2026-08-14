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
};

export function CarrierStatusBadge({
  status,
}: {
  status: CarrierApplicationStatus;
}) {
  const t = useTranslations("admin.carriers.status");

  return <Badge className={STATUS_STYLES[status]}>{t(status)}</Badge>;
}
