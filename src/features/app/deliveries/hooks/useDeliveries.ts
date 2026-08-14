"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { useTabState } from "@/features/app/common/hooks";
import { useAuth } from "@/lib/auth-context";
import { deliveriesApi, type Shipment } from "../api/deliveries.api";
import type { DeliveryTab, DeliverySummaryView } from "../types";

/** Comma-separated for the route's `status` filter (split server-side). */
const TAB_STATUSES: Record<DeliveryTab, string> = {
  active: "PENDING,ASSIGNED,PICKED_UP,IN_TRANSIT",
  past: "DELIVERED,CANCELLED",
};

export const deliveryKeys = {
  list: (tab: DeliveryTab) => ["deliveries", "list", tab] as const,
  detail: (id: string) => ["deliveries", "detail", id] as const,
};

/**
 * The shipper-side tracking list. The API returns every shipment the caller
 * is a party to, so the same page also serves a carrier checking their runs -
 * the counterpart name is resolved relative to the viewer.
 */
export function useDeliveries() {
  const t = useTranslations("deliveries");
  const { user } = useAuth();
  const { activeTab, setActiveTab } = useTabState<DeliveryTab>("active");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: deliveryKeys.list(activeTab),
    queryFn: () =>
      deliveriesApi.list({ status: TAB_STATUSES[activeTab], limit: 50 }),
  });

  const deliveries: DeliverySummaryView[] = (data?.items ?? []).map(
    (shipment) => toSummary(shipment, user?.id ?? null, t)
  );

  return {
    activeTab,
    setActiveTab,
    deliveries,
    total: data?.total ?? 0,
    isLoading,
    isError,
    error: error instanceof Error ? error.message : null,
  };
}

function toSummary(
  shipment: Shipment,
  viewerId: string | null,
  t: ReturnType<typeof useTranslations>
): DeliverySummaryView {
  const counterpart =
    viewerId === shipment.shipperId ? shipment.carrier : shipment.shipper;

  return {
    id: shipment.id,
    title: shipment.listing?.title ?? t("card.defaultTitle"),
    status: shipment.status,
    pickupAddress: shipment.pickupAddress,
    dropoffAddress: shipment.dropoffAddress,
    priceCents: shipment.priceCents,
    counterpartName: counterpart.name,
    dateLabel: shipment.scheduledPickup
      ? t("card.scheduled", {
          date: format(new Date(shipment.scheduledPickup), "d MMM HH:mm"),
        })
      : t("card.created", {
          date: format(new Date(shipment.createdAt), "d MMM yyyy"),
        }),
  };
}
