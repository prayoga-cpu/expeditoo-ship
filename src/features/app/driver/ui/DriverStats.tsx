"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CheckCircle } from "lucide-react";
import { useDriverShipments } from "../hooks/useDriverShipments";
import { useTranslations } from "next-intl";

/**
 * Execution-only stats. A driver never sees prices, offers or payouts
 * (docs/specs/roles_spec.md §3), so there is no earnings tile here.
 */
export function DriverStats() {
  const t = useTranslations("driver.dashboard.stats");
  const { shipments } = useDriverShipments();

  const assignedCount = shipments.filter(
    (s) => s.status === "ASSIGNED"
  ).length;

  const inProgressCount = shipments.filter(
    (s) => s.status === "PICKED_UP" || s.status === "IN_TRANSIT"
  ).length;

  const deliveredCount = shipments.filter(
    (s) => s.status === "DELIVERED"
  ).length;

  const tiles = [
    {
      title: t("assigned"),
      hint: t("assignedHint"),
      value: assignedCount,
      icon: Package,
    },
    {
      title: t("inProgress"),
      hint: t("inProgressHint"),
      value: inProgressCount,
      icon: Truck,
    },
    {
      title: t("delivered"),
      hint: t("deliveredHint"),
      value: deliveredCount,
      icon: CheckCircle,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {tiles.map((tile) => (
        <Card key={tile.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tile.title}</CardTitle>
            <tile.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tile.value}</div>
            <p className="text-xs text-muted-foreground">{tile.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
