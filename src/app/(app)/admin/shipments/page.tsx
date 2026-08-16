"use client";

import { DeliveriesTable } from "@/features/app/admin/ui/DeliveriesTable";
import { usePendingShipments } from "@/features/app/admin/hooks/useAdminShipments";
import { AlertCircle, Truck } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";

/**
 * Read-only oversight of shipments in flight. Admins no longer pick the
 * carrier: the shipper accepts an offer and the carrier takes the job itself,
 * so the table's assign action has nothing to open.
 */
export default function ShipmentsPage() {
  const { data: pendingDeliveries, isLoading, error } = usePendingShipments();
  const t = useTranslations("shipments");

  if (isLoading) {
    return <PageLoader />;
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
        // The proposals dialog behind this action is gone; the column itself
        // should follow in DeliveriesTable rather than reopen a stub here.
        onAssignClick={() => undefined}
        className="flex-1 min-h-0 flex flex-col"
      />
    </div>
  );
}
