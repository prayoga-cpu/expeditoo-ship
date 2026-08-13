import { useQuery } from "@tanstack/react-query";
import { useTabState } from "@/features/app/common/hooks";
import { fetchShipments, type ShipmentListItem } from "../api";
import type { DeliveryTab, Delivery } from "../types";
import { useTranslations } from "next-intl";

/**
 * Custom hook for managing deliveries data and state
 * Follows Single Responsibility Principle - handles only deliveries data logic
 *
 * Fetches from API using TanStack Query
 */
export function useDeliveries() {
  const t = useTranslations("deliveries");
  const { activeTab, setActiveTab } = useTabState<DeliveryTab>("incoming");

  // Fetch shipments from API
  const {
    data: incomingData,
    isLoading: isLoadingIncoming,
    isError: isErrorIncoming,
    error: errorIncoming,
  } = useQuery({
    queryKey: ["shipments", "incoming"],
    queryFn: () => fetchShipments({ type: "incoming" }),
  });

  const {
    data: outgoingData,
    isLoading: isLoadingOutgoing,
    isError: isErrorOutgoing,
    error: errorOutgoing,
  } = useQuery({
    queryKey: ["shipments", "outgoing"],
    queryFn: () => fetchShipments({ type: "outgoing" }),
  });

  // Transform API response to UI format
  const transformShipment = (shipment: ShipmentListItem): Delivery => ({
    id: shipment.id,
    title: shipment.listing?.title || shipment.packageDescription || t("card.defaultTitle"),
    origin: shipment.originAddress,
    destination: shipment.destinationAddress,
    dates: shipment.scheduledDate
      ? t("card.scheduled", { date: new Date(shipment.scheduledDate).toLocaleDateString() })
      : t("card.created", { date: new Date(shipment.createdAt).toLocaleDateString() }),
    status: mapApiStatusToUiStatus(shipment.status),
    driver: shipment.driver?.name || undefined,
    price: shipment.price ? shipment.price / 100 : 0, // Convert cents to euros
  });

  // Map API status to UI status
  function mapApiStatusToUiStatus(
    apiStatus: string
  ): Delivery["status"] {
    const statusMap: Record<string, Delivery["status"]> = {
      PENDING: "pending",
      PRICE_PROPOSED: "pending",
      ASSIGNED: "accepted",
      PICKED_UP: "picked_up",
      IN_TRANSIT: "in_transit",
      DELIVERED: "delivered",
      CANCELLED: "cancelled",
    };
    return statusMap[apiStatus] || "pending";
  }

  // Transform data
  const incoming: Delivery[] = (incomingData?.data || []).map(transformShipment);
  const outgoing: Delivery[] = (outgoingData?.data || []).map(transformShipment);

  // Get current tab deliveries
  const currentDeliveries = activeTab === "incoming" ? incoming : outgoing;

  // Combined loading and error states
  const isLoading = isLoadingIncoming || isLoadingOutgoing;
  const isError = isErrorIncoming || isErrorOutgoing;
  const error = errorIncoming || errorOutgoing;

  return {
    activeTab,
    setActiveTab,
    deliveries: currentDeliveries,
    allDeliveries: { incoming, outgoing },
    isLoading,
    isError,
    error: error instanceof Error ? error.message : null,
  };
}

