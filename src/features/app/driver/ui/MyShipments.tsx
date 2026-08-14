"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Calendar, ArrowRight, Package } from "lucide-react";
import Link from "next/link";
import { useDriverShipments } from "../hooks/useDriverShipments";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import {
  ShipmentStatusBadge,
  STATUS_ACCENT_CLASSES,
} from "./ShipmentStatusBadge";
import type { DriverShipment } from "../api/shipments.api";
import { useTranslations } from "next-intl";

type FilterCategory = "ALL" | "ASSIGNED" | "ACTIVE" | "DELIVERED" | "CANCELLED";

function matchesFilter(shipment: DriverShipment, filter: FilterCategory) {
  switch (filter) {
    case "ALL":
      return true;
    case "ASSIGNED":
      return shipment.status === "ASSIGNED";
    case "ACTIVE":
      return (
        shipment.status === "PICKED_UP" || shipment.status === "IN_TRANSIT"
      );
    case "DELIVERED":
      return shipment.status === "DELIVERED";
    case "CANCELLED":
      return shipment.status === "CANCELLED";
  }
}

export function MyShipments() {
  const t = useTranslations("driver.shipments");
  const tCommon = useTranslations("common");
  const [filter, setFilter] = useState<FilterCategory>("ALL");
  const { shipments, isLoading } = useDriverShipments();

  if (isLoading) {
    return <PageLoader variant="default" className="xl:min-h-screen" />;
  }

  const filteredShipments = shipments.filter((shipment) =>
    matchesFilter(shipment, filter)
  );

  return (
    <div className="flex flex-col flex-1 gap-6 h-full">
      <div className="flex items-center shrink-0">
        <Select
          value={filter}
          onValueChange={(val) => setFilter(val as FilterCategory)}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder={t("filters.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("filters.all")}</SelectItem>
            <SelectItem value="ASSIGNED">{t("filters.assigned")}</SelectItem>
            <SelectItem value="ACTIVE">{t("filters.active")}</SelectItem>
            <SelectItem value="DELIVERED">{t("filters.completed")}</SelectItem>
            <SelectItem value="CANCELLED">{t("filters.cancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 flex flex-col">
        {filteredShipments.length === 0 ? (
          <CenteredEmptyState
            icon={Package}
            title={t("empty.title")}
            description={t("empty.description")}
          />
        ) : (
          <div className="grid gap-4">
            {filteredShipments.map((shipment) => (
              <Card key={shipment.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row md:items-center">
                    <div
                      className={`w-1.5 self-stretch ${STATUS_ACCENT_CLASSES[shipment.status]}`}
                    />

                    <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-0 md:grid md:grid-cols-12 md:gap-4 items-center">
                      {/* Title & Status */}
                      <div className="col-span-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg line-clamp-1">
                            {shipment.listing?.title || t("defaultTitle")}
                          </h3>
                          <ShipmentStatusBadge status={shipment.status} />
                        </div>
                      </div>

                      {/* Route */}
                      <div className="col-span-5 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {shipment.pickupAddress}
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {shipment.dropoffAddress}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground pl-6">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {shipment.scheduledPickup
                              ? new Date(
                                  shipment.scheduledPickup
                                ).toLocaleDateString()
                              : t("flexible")}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="col-span-3 flex justify-end">
                        <Button variant="secondary" size="sm" asChild>
                          <Link href={`/driver/shipments/${shipment.id}`}>
                            {tCommon("buttons.seeMore")}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
