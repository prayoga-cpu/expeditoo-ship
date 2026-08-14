"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, ArrowRight, Truck } from "lucide-react";
import Link from "next/link";
import { useDriverShipments } from "../hooks/useDriverShipments";
import { ShipmentStatusBadge } from "./ShipmentStatusBadge";
import { useTranslations } from "next-intl";

const ACTIVE_STATUSES = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] as const;

export function ActiveShipments() {
  const t = useTranslations("driver.dashboard.activeDeliveries");
  const tCommon = useTranslations("common.buttons");
  const { shipments } = useDriverShipments();

  const activeShipments = shipments.filter((shipment) =>
    (ACTIVE_STATUSES as readonly string[]).includes(shipment.status)
  );

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          {t("title")}
        </CardTitle>
        <Link href="/driver/shipments">
          <Button variant="outline" size="sm">
            {tCommon("viewAll")}
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activeShipments.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            activeShipments.map((shipment) => (
              <div
                key={shipment.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">
                      {shipment.listing?.title || t("defaultTitle")}
                    </h4>
                    <ShipmentStatusBadge status={shipment.status} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">
                      {shipment.pickupAddress}
                    </span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">
                      {shipment.dropoffAddress}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {shipment.scheduledPickup
                        ? new Date(shipment.scheduledPickup).toLocaleDateString()
                        : t("flexible")}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/driver/shipments/${shipment.id}`}>
                    {t("details")}
                  </Link>
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
