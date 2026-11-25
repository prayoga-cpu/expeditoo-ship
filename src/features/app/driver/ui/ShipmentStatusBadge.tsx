"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import type { DriverShipmentStatus } from "../api/shipments.api";

const BADGE_CLASSES: Record<DriverShipmentStatus, string> = {
  PENDING:
    "tone-warning",
  ASSIGNED:
    "tone-info",
  PICKED_UP:
    "tone-info",
  IN_TRANSIT:
    "tone-info",
  DELIVERED:
    "tone-success",
  CANCELLED:
    "tone-danger",
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
