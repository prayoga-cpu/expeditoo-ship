"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Camera,
  CheckCircle,
  Clock,
  ImageIcon,
  Navigation,
  Package,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  useUpdateShipmentStatus,
  useUploadProofOfDelivery,
} from "../hooks/useDriverShipments";
import type { DriverShipment } from "../api/shipments.api";

/**
 * The driver's controls for a run. Buttons mirror the legal transitions of the
 * shipment service exactly: ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED.
 * Proof of delivery is the preferred way to close the run; a photo-less
 * DELIVERED transition stays available so a broken camera never blocks a
 * delivery.
 */

export type ActionableShipment = Pick<
  DriverShipment,
  "id" | "status" | "pickupAddress" | "dropoffAddress" | "proofOfDeliveryUrl"
>;

interface ShipmentActionsProps {
  shipment: ActionableShipment;
  isMobile?: boolean;
}

export function ShipmentActions({
  shipment,
  isMobile = false,
}: ShipmentActionsProps) {
  const t = useTranslations("driver.actions");

  const content = <ActionsForStatus shipment={shipment} />;

  if (isMobile) {
    return <div className="bg-background border-t p-4 shadow-lg">{content}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("actions")}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

function ActionsForStatus({ shipment }: { shipment: ActionableShipment }) {
  switch (shipment.status) {
    case "ASSIGNED":
      return <AssignedActions shipment={shipment} />;
    case "PICKED_UP":
      return <PickedUpActions shipment={shipment} />;
    case "IN_TRANSIT":
      return <InTransitActions shipment={shipment} />;
    case "DELIVERED":
      return <DeliveredState shipment={shipment} />;
    case "CANCELLED":
      return <CancelledState />;
    default:
      return <PendingState />;
  }
}

// ---- Per-status blocks ----

function AssignedActions({ shipment }: { shipment: ActionableShipment }) {
  const t = useTranslations("driver.actions");
  const updateStatus = useUpdateShipmentStatus(shipment.id);

  return (
    <div className="space-y-4">
      <StatusBanner
        tone="info"
        icon={Package}
        title={t("assignedTitle")}
        description={t("assignedDesc")}
      />
      <Button
        className="w-full gap-2"
        size="lg"
        onClick={() => updateStatus.mutate({ status: "PICKED_UP" })}
        disabled={updateStatus.isPending}
      >
        <Package className="w-5 h-5" />
        {updateStatus.isPending ? t("updating") : t("confirmPickup")}
      </Button>
      <NavigateButton
        address={shipment.pickupAddress}
        label={t("navigateToPickup")}
      />
    </div>
  );
}

function PickedUpActions({ shipment }: { shipment: ActionableShipment }) {
  const t = useTranslations("driver.actions");
  const updateStatus = useUpdateShipmentStatus(shipment.id);

  return (
    <div className="space-y-4">
      <StatusBanner
        tone="progress"
        icon={Truck}
        title={t("pickedUpTitle")}
        description={t("pickedUpDesc")}
      />
      <Button
        className="w-full gap-2"
        size="lg"
        onClick={() => updateStatus.mutate({ status: "IN_TRANSIT" })}
        disabled={updateStatus.isPending}
      >
        <Truck className="w-5 h-5" />
        {updateStatus.isPending ? t("updating") : t("startTransit")}
      </Button>
      <NavigateButton
        address={shipment.dropoffAddress}
        label={t("navigateToDropoff")}
      />
    </div>
  );
}

function InTransitActions({ shipment }: { shipment: ActionableShipment }) {
  const t = useTranslations("driver.actions");
  const updateStatus = useUpdateShipmentStatus(shipment.id);
  const uploadPod = useUploadProofOfDelivery(shipment.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = uploadPod.isPending || updateStatus.isPending;

  const handlePodFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("errors.invalidFile"));
      return;
    }
    uploadPod.mutate(file);
  };

  return (
    <div className="space-y-4">
      <StatusBanner
        tone="progress"
        icon={Truck}
        title={t("inTransit")}
        description={t("inTransitDesc")}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePodFile}
      />
      <Button
        className="w-full gap-2"
        size="lg"
        onClick={() => fileInputRef.current?.click()}
        disabled={isBusy}
      >
        <Camera className="w-5 h-5" />
        {uploadPod.isPending ? t("uploadingProof") : t("deliverWithPhoto")}
      </Button>
      <p className="text-xs text-center text-muted-foreground">{t("podHint")}</p>
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => updateStatus.mutate({ status: "DELIVERED" })}
        disabled={isBusy}
      >
        <CheckCircle className="w-4 h-4" />
        {updateStatus.isPending ? t("updating") : t("markDelivered")}
      </Button>
      <NavigateButton
        address={shipment.dropoffAddress}
        label={t("navigateToDropoff")}
      />
    </div>
  );
}

function DeliveredState({ shipment }: { shipment: ActionableShipment }) {
  const t = useTranslations("driver.actions");

  return (
    <div className="space-y-4">
      <StatusBanner
        tone="success"
        icon={CheckCircle}
        title={t("deliveryCompleted")}
        description={t("deliveryCompletedDesc")}
      />
      {shipment.proofOfDeliveryUrl && (
        <Button variant="outline" className="w-full gap-2" asChild>
          <a
            href={shipment.proofOfDeliveryUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ImageIcon className="w-4 h-4" />
            {t("viewProof")}
          </a>
        </Button>
      )}
    </div>
  );
}

function CancelledState() {
  const t = useTranslations("driver.actions");

  return (
    <StatusBanner
      tone="danger"
      icon={XCircle}
      title={t("cancelledTitle")}
      description={t("cancelledDesc")}
    />
  );
}

function PendingState() {
  const t = useTranslations("driver.actions");

  return (
    <StatusBanner
      tone="muted"
      icon={Clock}
      title={t("pendingTitle")}
      description={t("pendingDesc")}
    />
  );
}

// ---- Shared pieces ----

const BANNER_TONES = {
  info: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200",
  progress:
    "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900 text-purple-800 dark:text-purple-200",
  success:
    "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-800 dark:text-green-200",
  danger:
    "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200",
  muted: "bg-muted/50 border-border text-muted-foreground",
} as const;

function StatusBanner({
  tone,
  icon: Icon,
  title,
  description,
}: {
  tone: keyof typeof BANNER_TONES;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className={`border rounded-lg p-4 text-sm ${BANNER_TONES[tone]}`}>
      <p className="font-medium flex items-center gap-2">
        <Icon className="w-4 h-4 shrink-0" />
        {title}
      </p>
      <p className="mt-1 opacity-90">{description}</p>
    </div>
  );
}

function NavigateButton({ address, label }: { address: string; label: string }) {
  return (
    <Button variant="outline" className="w-full gap-2" asChild>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Navigation className="w-4 h-4" />
        {label}
      </a>
    </Button>
  );
}
