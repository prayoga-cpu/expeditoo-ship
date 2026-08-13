"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Calendar,
  Package,
  Euro,
  Search,
  ArrowRight,
} from "lucide-react";
import { useDriverShipments } from "../hooks/useDriverShipments";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";

import { useTranslations } from "next-intl";

export function ShipmentProposals() {
  const t = useTranslations("driver.shipments.proposals");
  const [searchQuery, setSearchQuery] = useState("");
  const { availableShipments } = useDriverShipments();

  const filteredShipments = availableShipments.filter(
    (shipment) =>
      shipment.originAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.destinationAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );



  return (
    <div className="flex flex-col flex-1 gap-6 h-full">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between shrink-0">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          {t("title")}
        </h2>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filteredShipments.length === 0 ? (
        <CenteredEmptyState
          icon={Package}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredShipments.map((shipment) => (
            <Card key={shipment.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base font-medium line-clamp-1">
                    {shipment.listing?.title || shipment.packageDescription || t("defaultTitle")}
                  </CardTitle>
                  {shipment.price && (
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary"
                    >
                      €{shipment.price / 100}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-1 flex-1 overflow-hidden">
                      <span className="font-medium truncate">{shipment.originAddress}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{shipment.destinationAddress}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {shipment.scheduledDate
                        ? new Date(shipment.scheduledDate).toLocaleDateString()
                        : "Flexible"}
                    </span>
                  </div>
                </div>

                <Link href={`/driver/shipments/${shipment.id}`}>
                  <Button className="w-full gap-2">
                    <Euro className="w-4 h-4" />
                    {t("viewAndPropose")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
