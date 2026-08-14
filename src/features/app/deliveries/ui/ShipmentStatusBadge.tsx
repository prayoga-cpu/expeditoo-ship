import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import type { ShipmentStatus } from "../api/deliveries.api";

/** Theme-token tones so the badge reads correctly in light and dark. */
const STATUS_TONE: Record<ShipmentStatus, string> = {
  PENDING: "bg-warning/15 text-warning border-warning/30",
  ASSIGNED: "bg-primary/15 text-primary border-primary/30",
  PICKED_UP: "bg-primary/15 text-primary border-primary/30",
  IN_TRANSIT: "bg-primary/15 text-primary border-primary/30",
  DELIVERED: "bg-success/15 text-success border-success/30",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const t = useTranslations("deliveries.shipmentStatus");

  return <Badge className={STATUS_TONE[status]}>{t(status)}</Badge>;
}
