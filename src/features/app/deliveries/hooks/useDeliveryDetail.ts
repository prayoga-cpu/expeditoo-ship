import { useQuery } from "@tanstack/react-query";
import { fetchShipmentDetail, type ShipmentDetail } from "../api";
import type { DeliveryDetailData, DeliveryStatus, TimelineStatus } from "../types";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";

/**
 * Custom hook for fetching and managing single delivery detail
 * Follows Single Responsibility Principle - handles only delivery detail data
 *
 * Fetches from API using TanStack Query
 *
 * @param id - Delivery ID
 */
export function useDeliveryDetail(id: string) {
  const t = useTranslations("deliveries");
  const { user } = useAuth();
  const {
    data: shipment,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["shipment", id],
    queryFn: () => fetchShipmentDetail(id),
    enabled: !!id, // Only fetch if id is provided
  });

  // Transform API response to UI format
  const delivery: DeliveryDetailData | null = shipment
    ? transformShipmentToDelivery(shipment, t)
    : null;

  return {
    delivery,
    isLoading,
    isError,
    error: error instanceof Error ? error.message : null,
    user,
  };
}

/**
 * Transform API shipment detail to UI format
 */
function transformShipmentToDelivery(
  shipment: ShipmentDetail,
  t: ReturnType<typeof useTranslations>
): DeliveryDetailData {
  return {
    id: shipment.id,
    listingId: shipment.listing?.id || null,
    title:
      shipment.listing?.title ||
      shipment.packageDescription ||
      t("card.defaultTitle"),
    status: mapApiStatusToUiStatus(shipment.status),
    price: shipment.price ? shipment.price / 100 : 0,
    origin: shipment.originAddress,
    destination: shipment.destinationAddress,
    dates: formatDates(shipment.scheduledDate, shipment.createdAt, t),
    driver: {
      id: shipment.driver?.id,
      name: shipment.driver?.name || t("card.awaitingDriver"),
      rating: 4.8, // Default - will be replaced with real rating
      reviews: 0,
      phone: shipment.driver?.phone || "",
      email: "", // Not available in current API
      avatar: shipment.driver?.image || "/placeholder.svg?key=driver",
      vehicle: "Standard Vehicle", // Not available in current API
    },
    userId: shipment.user.id,
    timeline: transformTimeline(shipment.timeline),
    hasReviewed: shipment.hasReviewed,
  };
}

/**
 * Map API status to UI status
 */
function mapApiStatusToUiStatus(apiStatus: string): DeliveryStatus {
  const statusMap: Record<string, DeliveryStatus> = {
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

/**
 * Format dates for display
 */
function formatDates(
  scheduledDate: string | null,
  createdAt: string,
  t: ReturnType<typeof useTranslations>
): string {
  if (scheduledDate) {
    return t("card.scheduled", { date: new Date(scheduledDate).toLocaleDateString() });
  }
  return t("card.created", { date: new Date(createdAt).toLocaleDateString() });
}

/**
 * Transform API timeline to UI format
 */
function transformTimeline(
  apiTimeline: ShipmentDetail["timeline"]
): DeliveryDetailData["timeline"] {
  const statusIcons: Record<string, string> = {
    PENDING: "📦",
    PRICE_PROPOSED: "💰",
    ASSIGNED: "✓",
    PICKED_UP: "🚚",
    IN_TRANSIT: "🗺️",
    DELIVERED: "📍",
    CANCELLED: "❌",
  };

  return apiTimeline.map((event, index) => {
    // Determine timeline status
    let timelineStatus: TimelineStatus;
    if (index < apiTimeline.length - 1) {
      timelineStatus = "completed";
    } else if (index === apiTimeline.length - 1) {
      timelineStatus =
        event.status === "DELIVERED" || event.status === "CANCELLED"
          ? "completed"
          : "active";
    } else {
      timelineStatus = "pending";
    }

    return {
      label: event.description,
      date: new Date(event.timestamp).toLocaleString(),
      status: timelineStatus,
      icon: statusIcons[event.status] || "📦",
    };
  });
}

