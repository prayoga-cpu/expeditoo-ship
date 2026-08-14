"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import type { DriverShipmentStatus } from "../api/shipments.api";

const BADGE_CLASSES: Record<DriverShipmentStatus, string> = {
  PENDING:
    "text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30",
  ASSIGNED:
    "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30",
  PICKED_UP:
    "text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30",
  IN_TRANSIT:
    "text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30",
  DELIVERED:
    "text-green-600 dark:text-green-400 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30",
  CANCELLED:
    "text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30",
};

/** Accent strip colour for list rows; pairs with the badge palette above. */
export const STATUS_ACCENT_CLASSES: Record<DriverShipmentStatus, string> = {
  PENDING: "bg-yellow-500",
  ASSIGNED: "bg-blue-500",
  PICKED_UP: "bg-purple-500",
  IN_TRANSIT: "bg-purple-500",
  DELIVERED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

export function ShipmentStatusBadge({
  status,
}: {
  status: DriverShipmentStatus;
}) {
  const t = useTranslations("driver.status");

  return (
    <Badge variant="outline" className={BADGE_CLASSES[status]}>
      {t(status)}
    </Badge>
  );
}
