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
import {
  MapPin,
  Calendar,
  ArrowRight,
  ArrowUpDown,
  Package,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { DateRangeField } from "@/components/ui/date-range-field";
import { useAuth } from "@/lib/auth-context";
import {
  deliveryDate,
  inWindow,
  pickupDate,
  sortShipments,
} from "../lib/shipment-list";
import { useDriverShipments } from "../hooks/useDriverShipments";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import {
  ShipmentStatusBadge,
  STATUS_ACCENT_CLASSES,
} from "./ShipmentStatusBadge";
import type { DriverShipment } from "../api/shipments.api";
import { useLocale, useTranslations } from "next-intl";

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
  const locale = useLocale();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterCategory>("ALL");
  // Soonest first: a driver plans the next run, not the last one
  // (client_feedback_2026_10_29_spec.md §N2).
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [range, setRange] = useState({ from: "", to: "" });
  const { shipments, isLoading, isError } = useDriverShipments();

  if (isLoading) {
    return <PageLoader className="xl:min-h-screen" />;
  }

  if (isError) {
    return (
      <CenteredEmptyState
        icon={Package}
        title={t("error.title")}
        description={t("error.description")}
      />
    );
  }

  const filteredShipments = sortShipments(
    shipments.filter(
      (shipment) =>
        matchesFilter(shipment, filter) &&
        inWindow(shipment, range.from, range.to)
    ),
    order
  );

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  return (
    <div className="flex flex-col flex-1 gap-6 h-full">
      <div className="flex flex-wrap items-center gap-2 shrink-0">
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
        <Button
          type="button"
          variant="outline"
          onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
          aria-label={t("order.toggle")}
        >
          <ArrowUpDown className="h-4 w-4" aria-hidden />
          {order === "asc" ? t("order.soonest") : t("order.latest")}
        </Button>
        <DateRangeField
          from={range.from}
          to={range.to}
          onChange={(from, to) => setRange({ from, to })}
        />
        {/* Pay lives with the carrier, never with a driver-only account
            (roles_spec.md) — « Mes paiements » from « Mes livraisons »
            (§N5 of the 29 October spec). */}
        {user?.roles?.includes("carrier") && (
          <Button variant="secondary" asChild className="md:ml-auto">
            <Link href="/carrier/withdrawals">
              <Wallet className="h-4 w-4" aria-hidden />
              {t("myPayments")}
            </Link>
          </Button>
        )}
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
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground pl-6">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" aria-hidden />
                            {(() => {
                              const at = pickupDate(shipment);
                              if (!at) return t("flexible");
                              return shipment.pickedUpAt
                                ? t("dates.pickedUp", { date: day(at) })
                                : t("dates.pickup", { date: day(at) });
                            })()}
                          </span>
                          {(() => {
                            const at = deliveryDate(shipment);
                            if (!at) return null;
                            return (
                              <span className="inline-flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" aria-hidden />
                                {shipment.deliveredAt
                                  ? t("dates.delivered", { date: day(at) })
                                  : t("dates.delivery", { date: day(at) })}
                              </span>
                            );
                          })()}
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
