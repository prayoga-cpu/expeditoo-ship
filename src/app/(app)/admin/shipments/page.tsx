"use client";

import { DeliveriesTable } from "@/features/app/admin/ui/DeliveriesTable";
import { ShipmentProposalsDialog } from "@/features/app/admin/ui/ShipmentProposalsDialog";
import { usePendingShipments } from "@/features/app/admin/hooks/useAdminShipments";
import { AlertCircle, Truck } from "lucide-react";
import { useState, useCallback } from "react";
import type { PendingDelivery } from "@/features/app/admin/types";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";

export default function ShipmentsPage() {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] =
    useState<PendingDelivery | null>(null);
  const { data: pendingDeliveries, isLoading, error } = usePendingShipments();
  const t = useTranslations("shipments");

  const handleAssignClick = useCallback((delivery: PendingDelivery) => {
    setSelectedDelivery(delivery);
    setAssignDialogOpen(true);
  }, []);

  const handleAssignDriver = useCallback(
    async (driverId: string) => {
      // TODO: Implement actual driver assignment API call
      console.log(
        "Assigning driver",
        driverId,
        "to shipment",
        selectedDelivery?.id
      );
      setAssignDialogOpen(false);
    },
    [selectedDelivery?.id]
  );

  if (isLoading) {
    return <PageLoader variant="admin" />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-6 w-6 mr-2" />
        <span>Failed to load shipments</span>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Truck className="w-8 h-8 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <DeliveriesTable
        deliveries={pendingDeliveries || []}
        onAssignClick={handleAssignClick}
        className="flex-1 min-h-0 flex flex-col"
      />

      <ShipmentProposalsDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        onAssign={handleAssignDriver}
        delivery={selectedDelivery}
      />
    </div>
  );
}
