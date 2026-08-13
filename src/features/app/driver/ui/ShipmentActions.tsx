"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CheckCircle, Upload, Navigation } from "lucide-react";
import { toast } from "sonner";
import { ProposalForm, type ShipmentPricingData } from "./ProposalForm";
import {
  updateShipmentStatus,
  fetchShipments,
} from "@/features/app/deliveries/api";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

interface ShipmentActionsProps {
  shipmentId: string;
  status: string;
  isMobile?: boolean;
  /** Shipment data for pricing calculation */
  shipmentData?: ShipmentPricingData;
  /** Whether the buyer has paid for the shipment */
  isPaymentConfirmed?: boolean;
  destinationAddress?: string;
}

export function ShipmentActions({
  shipmentId,
  status,
  isMobile = false,
  shipmentData,
  isPaymentConfirmed = false,
  destinationAddress,
}: ShipmentActionsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();
  const t = useTranslations("driver.actions");

  const handleStatusUpdate = async (
    newStatus: string,
    successMessage: string
  ) => {
    setIsUpdating(true);
    try {
      await updateShipmentStatus(shipmentId, newStatus);
      toast.success(successMessage);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["shipment", shipmentId] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update status";
      // Check for payment required error
      if (
        errorMessage.includes("payment") ||
        errorMessage.includes("Payment")
      ) {
        toast.error("Cannot pick up yet - buyer has not completed payment");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // 1. PENDING or PRICE_PROPOSED -> Show Proposal Form
  // But first, check if we already proposed
  const { data: myProposalsData } = useQuery({
    queryKey: ["shipments", "proposals"],
    queryFn: () => fetchShipments({ type: "proposals" as never }),
    staleTime: 1000 * 60 * 5, // 5 minutes (we rely on invalidation)
  });

  // Check if myProposalsData.data contains shipmentId
  const hasProposed = myProposalsData?.data.some((s) => s.id === shipmentId);

  if (status === "PENDING" || status === "PRICE_PROPOSED") {
    if (hasProposed) {
      const Content = (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="flex justify-center mb-2">
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-blue-900">
              {t("proposalSubmitted")}
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              {t("proposalSubmittedDesc")}
            </p>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/driver/shipments">{t("backToShipments")}</Link>
          </Button>
        </div>
      );

      if (isMobile) {
        return (
          <div className="bg-background border-t p-4 shadow-lg">{Content}</div>
        );
      }

      return (
        <Card>
          <CardHeader>
            <CardTitle>{t("status")}</CardTitle>
          </CardHeader>
          <CardContent>{Content}</CardContent>
        </Card>
      );
    }
    return (
      <ProposalForm
        shipmentId={shipmentId}
        isMobile={isMobile}
        shipmentData={shipmentData}
      />
    );
  }

  // 2. ASSIGNED -> Show "Mark as Picked Up" but check payment status
  if (status === "ASSIGNED") {
    const Content = (
      <div className="space-y-4">
        <div
          className={`bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 ${isPaymentConfirmed ? "hidden" : ""}`}
        >
          <p className="font-medium flex items-center gap-2">
            <Truck className="w-4 h-4" />
            {t("awaitingPayment")}
          </p>
          <p className="mt-1">{t("awaitingPaymentDesc")}</p>
        </div>

        <Button
          className="w-full gap-2"
          size="lg"
          onClick={() =>
            handleStatusUpdate("PICKED_UP", "Shipment marked as picked up")
          }
          disabled={isUpdating || !isPaymentConfirmed}
        >
          <Package className="w-5 h-5" />
          {isUpdating ? t("updating") : t("confirmPickup")}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          {t("paymentNotConfirmed")}
        </p>

        <Button variant="outline" className="w-full gap-2" asChild>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
              "Pickup Address Placeholder" // Ideally pass address as prop
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation className="w-4 h-4" />
            {t("navigateToPickup")}
          </a>
        </Button>
      </div>
    );

    if (isMobile) {
      return (
        <div className="bg-background border-t p-4 shadow-lg">{Content}</div>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("actions")}</CardTitle>
        </CardHeader>
        <CardContent>{Content}</CardContent>
      </Card>
    );
  }

  // 3. PICKED_UP / IN_TRANSIT -> Show "Mark as Delivered"
  if (status === "PICKED_UP" || status === "IN_TRANSIT") {
    const Content = (
      <div className="space-y-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800">
          <p className="font-medium flex items-center gap-2">
            <Truck className="w-4 h-4" />
            {t("inTransit")}
          </p>
          <p className="mt-1">{t("inTransitDesc")}</p>
        </div>

        {/* Start Journey - Primary Action for PICKED_UP */}
        {status === "PICKED_UP" && (
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() =>
              handleStatusUpdate("IN_TRANSIT", "Shipment marked as in transit")
            }
            disabled={isUpdating}
          >
            <Truck className="w-5 h-5" />
            {isUpdating ? t("updating") : t("startJourney")}
          </Button>
        )}

        {/* Navigate Button */}
        <Button variant="outline" className="w-full gap-2" asChild>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
              destinationAddress || ""
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation className="w-4 h-4" />
            {t("navigateToDropoff")}
          </a>
        </Button>

        {/* Confirm Delivery - Only for IN_TRANSIT */}
        {status === "IN_TRANSIT" && (
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() =>
              handleStatusUpdate("DELIVERED", "Shipment marked as delivered")
            }
            disabled={isUpdating}
          >
            <CheckCircle className="w-5 h-5" />
            {isUpdating ? t("updating") : t("confirmDelivery")}
          </Button>
        )}

        {status === "IN_TRANSIT" && (
          <Button variant="outline" className="w-full gap-2">
            <Upload className="w-4 h-4" />
            {t("uploadProof")}
          </Button>
        )}
      </div>
    );

    if (isMobile) {
      return (
        <div className="bg-background border-t p-4 shadow-lg">{Content}</div>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("actions")}</CardTitle>
        </CardHeader>
        <CardContent>{Content}</CardContent>
      </Card>
    );
  }

  // 4. DELIVERED / COMPLETED -> Show Summary
  if (status === "DELIVERED" || status === "COMPLETED") {
    const Content = (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="flex justify-center mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-semibold text-green-900">
            {t("deliveryCompleted")}
          </h3>
          <p className="text-sm text-green-700 mt-1">
            {t("deliveryCompletedDesc")}
          </p>
        </div>
      </div>
    );

    if (isMobile) {
      return (
        <div className="bg-background border-t p-4 shadow-lg">{Content}</div>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("status")}</CardTitle>
        </CardHeader>
        <CardContent>{Content}</CardContent>
      </Card>
    );
  }

  return null;
}
