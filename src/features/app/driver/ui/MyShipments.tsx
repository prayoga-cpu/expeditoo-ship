"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Calendar,
  ArrowRight,
  Search,
  Package,
} from "lucide-react";
import Link from "next/link";
import { useDriverShipments } from "../hooks/useDriverShipments";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";

import { useTranslations } from "next-intl";

type FilterCategory =
  | "ALL"
  | "WAITING"
  | "APPROVED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export function MyShipments() {
  const t = useTranslations("driver.shipments");
  const tCommon = useTranslations("common");
  const [activeTab, setActiveTab] = useState<FilterCategory>("ALL");
  const { myShipments, isLoading } = useDriverShipments();

  if (isLoading) {
    return <PageLoader variant="default" className="xl:min-h-[100vh]" />;
  }

  const filteredShipments = myShipments.filter((shipment) => {
    if (activeTab === "ALL") return true;

    if (activeTab === "WAITING") {
      return (
        shipment.status === "PENDING" || shipment.status === "PRICE_PROPOSED"
      );
    }
    if (activeTab === "APPROVED") {
      return shipment.status === "ASSIGNED";
    }
    if (activeTab === "ACTIVE") {
      return (
        shipment.status === "PICKED_UP" || shipment.status === "IN_TRANSIT"
      );
    }
    if (activeTab === "COMPLETED") {
      return shipment.status === "DELIVERED";
    }
    if (activeTab === "CANCELLED") {
      return shipment.status === "CANCELLED";
    }
    return false;
  });



  return (
    <div className="flex flex-col flex-1 gap-6 h-full">
      <div className="flex items-center shrink-0">
        <Select
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as FilterCategory)}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder={t("filters.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("filters.all")}</SelectItem>
            <SelectItem value="WAITING">{t("filters.waiting")}</SelectItem>
            <SelectItem value="APPROVED">{t("filters.approved")}</SelectItem>
            <SelectItem value="ACTIVE">{t("filters.active")}</SelectItem>
            <SelectItem value="COMPLETED">{t("filters.completed")}</SelectItem>
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
                  <div className="flex flex-col md:flex-row md:items-center border-l-4 border-l-primary/50">
                    <div
                      className={`w-1.5 self-stretch ${getStatusColor(shipment.status)}`}
                    />

                    <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-0 md:grid md:grid-cols-12 md:gap-4 items-center">
                      {/* Title & Status */}
                      <div className="col-span-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg line-clamp-1">
                            {shipment.listing?.title ||
                              shipment.packageDescription ||
                              t("defaultTitle")}
                          </h3>
                          <Badge
                            variant="outline"
                            className={`${getStatusBadgeColor(shipment.status)}`}
                          >
                            {formatStatus(shipment.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {shipment.price && (
                            <span className="font-medium text-foreground">
                              €{shipment.price / 100}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Route */}
                      <div className="col-span-5 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {shipment.originAddress}
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {shipment.destinationAddress}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground pl-6">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {shipment.scheduledDate
                              ? new Date(
                                shipment.scheduledDate
                              ).toLocaleDateString()
                              : "Flexible"}
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

function getStatusColor(status: string) {
  switch (status) {
    case "PENDING":
    case "PRICE_PROPOSED":
      return "bg-yellow-500";
    case "ASSIGNED":
      return "bg-blue-500";
    case "PICKED_UP":
    case "IN_TRANSIT":
      return "bg-purple-500";
    case "DELIVERED":
      return "bg-green-500";
    case "CANCELLED":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case "PENDING":
    case "PRICE_PROPOSED":
      return "text-yellow-600 border-yellow-200 bg-yellow-50";
    case "ASSIGNED":
      return "text-blue-600 border-blue-200 bg-blue-50";
    case "PICKED_UP":
    case "IN_TRANSIT":
      return "text-purple-600 border-purple-200 bg-purple-50";
    case "DELIVERED":
      return "text-green-600 border-green-200 bg-green-50";
    case "CANCELLED":
      return "text-red-600 border-red-200 bg-red-50";
    default:
      return "text-gray-600";
  }
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}
