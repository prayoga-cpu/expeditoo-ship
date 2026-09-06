"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  Clock,
  Navigation,
  Package,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useAssignSelfToShipment,
  useUpdateShipmentStatus,
  useWithdrawFromJob,
} from "../hooks/useDriverShipments";
import { StopTransportDialog } from "@/features/app/common/ui/StopTransportDialog";
import { useShipmentPhotos } from "@/features/app/common/hooks/useShipmentPhotos";
import {
  PhotoRequirementNotice,
  ShipmentPhotoCapture,
} from "@/features/app/common/ui/ShipmentPhotoCapture";
import { ShipmentPhotoGallery } from "@/features/app/common/ui/ShipmentPhotoGallery";
import type { DriverShipment } from "../api/shipments.api";

/**
 * The driver's controls for a run. Buttons mirror the legal transitions of the
 * shipment service exactly: PENDING → ASSIGNED → PICKED_UP → IN_TRANSIT →
 * DELIVERED. The first step is a self-assignment, because the carrier who won
 * the job is normally the person who will drive it.
 * Two of those moves now need evidence first. `ASSIGNED -> PICKED_UP` and
 * `IN_TRANSIT -> DELIVERED` are refused by the service until a photo of that
 * stage exists (shipment_photos_spec.md §3.6), so the buttons are disabled
 * rather than left to fail, and they say why.
 */

export type ActionableShipment = Pick<
  DriverShipment,
  "id" | "status" | "pickupAddress" | "dropoffAddress"
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
    case "PENDING":
      return <PendingActions shipment={shipment} />;
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

/**
 * The run has been paid for but nobody is on it yet. Claiming it is the only
 * way a solo carrier reaches the rest of the flow, so it is the primary action.
 */
function PendingActions({ shipment }: { shipment: ActionableShipment }) {
  const t = useTranslations("driver.actions");
  const assignSelf = useAssignSelfToShipment(shipment.id);

  return (
    <div className="space-y-4">
      <StatusBanner
        tone="muted"
        icon={Clock}
        title={t("unassignedTitle")}
        description={t("unassignedDesc")}
      />
      <Button
        className="w-full gap-2"
        size="lg"
        onClick={() => assignSelf.mutate()}
        disabled={assignSelf.isPending || !assignSelf.canAssign}
      >
        <Truck className="w-5 h-5" />
        {assignSelf.isPending ? t("startingJob") : t("startJob")}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        {t("startJobHint")}
      </p>
      <WithdrawAction shipmentId={shipment.id} />
    </div>
  );
}

function AssignedActions({ shipment }: { shipment: ActionableShipment }) {
  const t = useTranslations("driver.actions");
  const updateStatus = useUpdateShipmentStatus(shipment.id);
  const { pickup } = useShipmentPhotos(shipment.id);
  const hasEvidence = pickup.length > 0;

  return (
    <div className="space-y-4">
      <StatusBanner
        tone="info"
        icon={Package}
        title={t("assignedTitle")}
        description={t("assignedDesc")}
      />
      <ShipmentPhotoCapture shipmentId={shipment.id} stage="pickup" />
      <PhotoRequirementNotice show={!hasEvidence} />
      <Button
        className="w-full gap-2"
        size="lg"
        onClick={() => updateStatus.mutate({ status: "PICKED_UP" })}
        disabled={updateStatus.isPending || !hasEvidence}
      >
        <Package className="w-5 h-5" />
        {updateStatus.isPending ? t("updating") : t("confirmPickup")}
      </Button>
      <NavigateButton
        address={shipment.pickupAddress}
        label={t("navigateToPickup")}
      />
      <WithdrawAction shipmentId={shipment.id} />
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
  const { delivery } = useShipmentPhotos(shipment.id);
  const hasEvidence = delivery.length > 0;

  return (
    <div className="space-y-4">
      <StatusBanner
        tone="progress"
        icon={Truck}
        title={t("inTransit")}
        description={t("inTransitDesc")}
      />
      <ShipmentPhotoCapture shipmentId={shipment.id} stage="delivery" />
      <PhotoRequirementNotice show={!hasEvidence} />
      <Button
        className="w-full gap-2"
        size="lg"
        onClick={() => updateStatus.mutate({ status: "DELIVERED" })}
        disabled={updateStatus.isPending || !hasEvidence}
      >
        <CheckCircle className="w-5 h-5" />
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
  const photos = useTranslations("shipmentPhotos");
  const { pickup, delivery } = useShipmentPhotos(shipment.id);

  return (
    <div className="space-y-4">
      <StatusBanner
        tone="success"
        icon={CheckCircle}
        title={t("deliveryCompleted")}
        description={t("deliveryCompletedDesc")}
      />
      <ShipmentPhotoGallery
        title={photos("pickupTitle")}
        photos={pickup}
        emptyLabel={photos("noneAtPickup")}
      />
      <ShipmentPhotoGallery
        title={photos("deliveryTitle")}
        photos={delivery}
        emptyLabel={photos("noneAtDelivery")}
      />
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

/**
 * Handing the job back, offered only while nothing has changed hands.
 *
 * Mounted inside the per-status blocks rather than at the `ShipmentActions`
 * level: the driver detail page mounts that component twice — a desktop sticky
 * column and a mobile sticky bar — so anything added at the top renders twice.
 *
 * The server is the authority on whether this is allowed; the button is simply
 * not offered where it would be refused (`WITHDRAW_AFTER_PICKUP`).
 */
function WithdrawAction({ shipmentId }: { shipmentId: string }) {
  const withdraw = useWithdrawFromJob(shipmentId);

  return (
    <StopTransportDialog
      side="transporter"
      isPending={withdraw.isPending}
      onConfirm={(input) => withdraw.mutateAsync(input)}
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
