"use client";

import { useParams, useRouter } from "next/navigation";
import { ShipmentRouteMap } from "@/features/app/driver/ui";
import { ShipmentActions } from "@/features/app/driver/ui/ShipmentActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Calendar,
  Package,
  Weight,
  Box,
  ArrowLeft,
} from "lucide-react";
import { useDriverShipmentDetail } from "@/features/app/driver/hooks/useDriverShipments";
import { useTranslations } from "next-intl";
import { PageLoader } from "@/components/ui/page-loader";

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
      {/* Back Button & Header Actions */}
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
              {shipment.listing?.title ||
                shipment.packageDescription ||
                t("shipmentDetails")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("shipmentNumber")}
              {id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="uppercase">
            {shipment.status.replace("_", " ")}
          </Badge>
          {shipment.price && (
            <Badge variant="secondary">
              {t("budget")}: €{shipment.price / 100}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column - Map and Details */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Map Section */}
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
                  lat: shipment.originLat,
                  lng: shipment.originLng,
                  address: shipment.originAddress,
                }}
                destination={{
                  lat: shipment.destinationLat,
                  lng: shipment.destinationLng,
                  address: shipment.destinationAddress,
                }}
              />
              <div className="p-4 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 bg-muted/30">
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      {t("pickup")}
                    </p>
                    <p className="font-medium text-sm md:text-base">
                      {shipment.originAddress}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-green-500" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      {t("dropoff")}
                    </p>
                    <p className="font-medium text-sm md:text-base">
                      {shipment.destinationAddress}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details Section */}
          <Card className="rounded-xl border">
            <CardHeader className="px-4 md:px-6">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Package className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                {t("shipmentDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 px-4 md:px-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs md:text-sm">{t("date")}</span>
                  </div>
                  <p className="font-medium text-sm md:text-base">
                    {shipment.scheduledDate
                      ? new Date(shipment.scheduledDate).toLocaleDateString()
                      : t("flexible")}
                  </p>
                </div>
                {shipment.packageWeight && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Weight className="w-4 h-4" />
                      <span className="text-xs md:text-sm">{t("weight")}</span>
                    </div>
                    <p className="font-medium text-sm md:text-base">
                      {shipment.packageWeight} kg
                    </p>
                  </div>
                )}
                {shipment.packageDimensions && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Box className="w-4 h-4" />
                      <span className="text-xs md:text-sm">
                        {t("dimensions")}
                      </span>
                    </div>
                    <p className="font-medium text-sm md:text-base">
                      {shipment.packageDimensions}
                    </p>
                  </div>
                )}
              </div>

              {shipment.packageDescription && (
                <div>
                  <h3 className="font-medium mb-2 text-sm md:text-base">
                    {t("description")}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                    {shipment.packageDescription}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions (Desktop Only) */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-24">
            <ShipmentActions
              shipmentId={id}
              status={shipment.status}
              isPaymentConfirmed={shipment.isPaymentConfirmed}
              shipmentData={{
                originLat: shipment.originLat,
                originLng: shipment.originLng,
                destinationLat: shipment.destinationLat,
                destinationLng: shipment.destinationLng,
                packageWeight: shipment.packageWeight,
                packageDimensions: shipment.packageDimensions,
              }}
              destinationAddress={shipment.destinationAddress}
            />
          </div>
        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <ShipmentActions
          shipmentId={id}
          status={shipment.status}
          isMobile
          isPaymentConfirmed={shipment.isPaymentConfirmed}
          shipmentData={{
            originLat: shipment.originLat,
            originLng: shipment.originLng,
            destinationLat: shipment.destinationLat,
            destinationLng: shipment.destinationLng,
            packageWeight: shipment.packageWeight,
            packageDimensions: shipment.packageDimensions,
          }}
          destinationAddress={shipment.destinationAddress}
        />
      </div>
    </div>
  );
}
