"use client";

import { useParams, useRouter } from "next/navigation";
import { ShipmentRouteMap } from "@/features/app/driver/ui";
import { ShipmentActions } from "@/features/app/driver/ui/ShipmentActions";
import { ShipmentStatusBadge } from "@/features/app/driver/ui/ShipmentStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Calendar,
  Package,
  Weight,
  Box,
  History,
  ArrowLeft,
} from "lucide-react";
import { useDriverShipmentDetail } from "@/features/app/driver/hooks/useDriverShipments";
import type {
  DriverShipmentDetail,
  DriverShipmentListing,
} from "@/features/app/driver/api/shipments.api";
import { useTranslations } from "next-intl";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * The driver's view of a run: route, time windows, cargo and history.
 * Commercial terms are stripped server-side for drivers, so nothing
 * price-shaped is rendered here.
 */
export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const t = useTranslations("driver.shipmentDetail");

  const { shipment, isLoading, isError } = useDriverShipmentDetail(id);

  if (isLoading) {
    return <PageLoader variant="driver" />;
  }

  if (isError || !shipment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-xl font-semibold">{t("notFound")}</h2>
        <Button onClick={() => router.back()}>{t("goBack")}</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto p-4 md:p-6 pb-32 md:pb-12">
      {/* Back Button & Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full -ml-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {shipment.listing?.title || t("shipmentDetails")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("shipmentNumber")}
              {id}
            </p>
          </div>
        </div>
        <ShipmentStatusBadge status={shipment.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column - Map and Details */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <RouteCard shipment={shipment} />
          <CargoCard shipment={shipment} />
          <TimelineCard shipment={shipment} />
        </div>

        {/* Right Column - Actions (Desktop Only) */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-24">
            <ShipmentActions shipment={shipment} />
          </div>
        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <ShipmentActions shipment={shipment} isMobile />
      </div>
    </div>
  );
}

function RouteCard({ shipment }: { shipment: DriverShipmentDetail }) {
  const t = useTranslations("driver.shipmentDetail");

  return (
    <Card className="overflow-hidden border">
      <CardHeader className="pb-2 px-4 md:px-6">
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <MapPin className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          {t("route")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ShipmentRouteMap
          origin={{
            lat: shipment.pickupLat,
            lng: shipment.pickupLng,
            address: shipment.pickupAddress,
          }}
          destination={{
            lat: shipment.dropoffLat,
            lng: shipment.dropoffLng,
            address: shipment.dropoffAddress,
          }}
        />
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 bg-muted/30">
          <RouteStop
            colorClass="bg-blue-500"
            label={t("pickup")}
            address={shipment.pickupAddress}
            scheduledAt={shipment.scheduledPickup}
            scheduledLabel={t("scheduledPickup")}
          />
          <RouteStop
            colorClass="bg-green-500"
            label={t("dropoff")}
            address={shipment.dropoffAddress}
            scheduledAt={shipment.scheduledDelivery}
            scheduledLabel={t("scheduledDelivery")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RouteStop({
  colorClass,
  label,
  address,
  scheduledAt,
  scheduledLabel,
}: {
  colorClass: string;
  label: string;
  address: string;
  scheduledAt: string | null;
  scheduledLabel: string;
}) {
  const t = useTranslations("driver.shipmentDetail");

  return (
    <div className="flex items-start gap-3">
      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${colorClass}`} />
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase">
          {label}
        </p>
        <p className="font-medium text-sm md:text-base">{address}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Calendar className="w-3 h-3" />
          {scheduledLabel}:{" "}
          {scheduledAt ? new Date(scheduledAt).toLocaleString() : t("flexible")}
        </p>
      </div>
    </div>
  );
}

function formatDimensions(listing: DriverShipmentListing | null) {
  if (!listing?.lengthCm || !listing.widthCm || !listing.heightCm) return null;
  return `${listing.lengthCm} × ${listing.widthCm} × ${listing.heightCm} cm`;
}

function CargoCard({ shipment }: { shipment: DriverShipmentDetail }) {
  const t = useTranslations("driver.shipmentDetail");
  const listing = shipment.listing;
  const dimensions = formatDimensions(listing);

  return (
    <Card className="rounded-xl border">
      <CardHeader className="px-4 md:px-6">
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <Package className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          {t("cargo")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-6 px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {listing && (
            <CargoFact
              icon={Weight}
              label={t("weight")}
              value={`${listing.weightKg} kg`}
            />
          )}
          {dimensions && (
            <CargoFact icon={Box} label={t("dimensions")} value={dimensions} />
          )}
          {listing && (
            <CargoFact
              icon={Package}
              label={t("quantity")}
              value={String(listing.quantity)}
            />
          )}
        </div>

        {(listing?.isFragile || listing?.needsHelp) && (
          <div className="flex flex-wrap gap-2">
            {listing.isFragile && (
              <Badge variant="outline">{t("fragile")}</Badge>
            )}
            {listing.needsHelp && (
              <Badge variant="outline">{t("needsHelp")}</Badge>
            )}
          </div>
        )}

        {listing?.description && (
          <div>
            <h3 className="font-medium mb-2 text-sm md:text-base">
              {t("description")}
            </h3>
            <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
              {listing.description}
            </p>
          </div>
        )}

        {shipment.status === "CANCELLED" && shipment.cancellationReason && (
          <div>
            <h3 className="font-medium mb-2 text-sm md:text-base">
              {t("cancellationReason")}
            </h3>
            <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
              {shipment.cancellationReason}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CargoFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Weight;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs md:text-sm">{label}</span>
      </div>
      <p className="font-medium text-sm md:text-base">{value}</p>
    </div>
  );
}

function TimelineCard({ shipment }: { shipment: DriverShipmentDetail }) {
  const t = useTranslations("driver.shipmentDetail");
  const tEvents = useTranslations("deliveries.events");

  const events = [...shipment.events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (events.length === 0) return null;

  return (
    <Card className="rounded-xl border">
      <CardHeader className="px-4 md:px-6">
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <History className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          {t("timeline")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        <ol className="space-y-4">
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-3">
              <div className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
              <div>
                <p className="font-medium text-sm md:text-base">
                  {tEvents(event.status)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
                {event.note && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {event.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
