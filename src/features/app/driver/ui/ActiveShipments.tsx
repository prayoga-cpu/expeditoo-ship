"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, ArrowRight, Truck } from "lucide-react";
import Link from "next/link";
import { useDriverShipments } from "../hooks/useDriverShipments";

import { useTranslations } from "next-intl";

export function ActiveShipments() {
  const t = useTranslations("driver.dashboard.activeDeliveries");
  const tCommon = useTranslations("common.buttons");
  const { myShipments } = useDriverShipments();

  const activeShipments = myShipments.filter((shipment) =>
    ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "APPROVED"].includes(shipment.status)
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
            <p className="text-muted-foreground text-sm">
              {t("empty")}
            </p>
          ) : (
            activeShipments.map((shipment) => (
              <div
                key={shipment.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">
                      {shipment.listing?.title || shipment.packageDescription || t("defaultTitle")}
                    </h4>
                    <Badge variant={getStatusVariant(shipment.status)}>
                      {formatStatus(shipment.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">{shipment.originAddress}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">{shipment.destinationAddress}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {shipment.scheduledDate
                        ? new Date(shipment.scheduledDate).toLocaleDateString()
                        : "Flexible"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">
                      {shipment.price ? `€${shipment.price / 100}` : "TBD"}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("earnings")}</p>
                  </div>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/driver/shipments/${shipment.id}`}>
                      {t("details")}
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "IN_TRANSIT":
      return "default";
    case "APPROVED":
    case "ASSIGNED":
    case "PICKED_UP":
      return "secondary";
    case "COMPLETED":
    case "DELIVERED":
      return "outline";
    default:
      return "secondary";
  }
}

function formatStatus(status: string) {
  return status.replace("_", " ");
}
