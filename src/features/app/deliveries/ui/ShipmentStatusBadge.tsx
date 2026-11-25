import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import type { ShipmentStatus } from "../api/deliveries.api";

/** Theme-token tones so the badge reads correctly in light and dark. */
const STATUS_TONE: Record<ShipmentStatus, string> = {
  PENDING: "tone-warning",
  ASSIGNED: "bg-primary/15 text-primary border-primary/30",
  PICKED_UP: "bg-primary/15 text-primary border-primary/30",
  IN_TRANSIT: "bg-primary/15 text-primary border-primary/30",
  DELIVERED: "tone-success",
  CANCELLED: "tone-danger",
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const t = useTranslations("deliveries.shipmentStatus");

  return <Badge className={STATUS_TONE[status]}>{t(status)}</Badge>;
}
