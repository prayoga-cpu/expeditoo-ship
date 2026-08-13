import { useQuery } from "@tanstack/react-query";
import type { PendingDelivery } from "../types";

// ========================================
// Types
// ========================================

interface ShipmentDriver {
  id: string;
  name: string;
  email: string;
}

interface ShipmentsApiResponse {
  success: boolean;
  data?: Array<{
    id: string;
    userId: string;
    listingId?: string | null;
    driverId?: string | null;
    status: string;
    originAddress: string;
    destinationAddress: string;
    packageDescription?: string | null;
    price?: number | null;
    createdAt: string;
    driver?: ShipmentDriver | null;
    listing?: {
      title: string;
    } | null;
    proposals?: Array<{ id: string }>;
  }>;
  error?: {
    code: string;
    message: string;
  };
}

// ========================================
// Fetch Function
// ========================================

async function fetchAdminShipments(): Promise<PendingDelivery[]> {
  const response = await fetch("/api/admin/shipments"); // ✅ Changed to admin endpoint
  const json: ShipmentsApiResponse = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to fetch shipments");
  }

  // Map API response to PendingDelivery format
  return (json.data || []).map((item) => ({
    id: item.id,
    title: item.listing?.title || item.packageDescription || "Shipment",
    origin: item.originAddress.split(",")[0] || item.originAddress,
    destination:
      item.destinationAddress.split(",")[0] || item.destinationAddress,
    status: item.status.toLowerCase(),
    price: item.price || 0,
    createdDate: item.createdAt,
    pickup: item.originAddress,
    dropoff: item.destinationAddress,
    date: item.createdAt,
    assignedDriver: item.driverId || undefined,
    proposalCount: item.proposals?.length || 0,
  }));
}

// ========================================
// Hook
// ========================================

export function useAdminShipments() {
  return useQuery({
    queryKey: ["admin", "shipments"],
    queryFn: fetchAdminShipments,
    // Auto-refetch every 5 seconds to show new data immediately
    refetchInterval: 5000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to get only pending shipments (not delivered or cancelled)
 */
export function usePendingShipments() {
  const query = useAdminShipments();

  const pendingShipments = (query.data || []).filter(
    (s) => s.status !== "delivered" && s.status !== "cancelled"
  );

  return {
    ...query,
    data: pendingShipments,
  };
}
