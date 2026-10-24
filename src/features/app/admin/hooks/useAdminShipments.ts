import { useQuery } from "@tanstack/react-query";
import type { AdminShipmentRow } from "@/server/services/shipment.service";
import type { PendingDelivery } from "../types";

type Wire<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] };

interface ShipmentsApiResponse {
  success: boolean;
  data?: Wire<AdminShipmentRow>[];
  error?: { code: string; message: string };
}

/** First segment of an address, for a route line when a run has no job. */
const town = (address: string) => address.split(",")[0] || address;

export function toPendingDelivery(item: Wire<AdminShipmentRow>): PendingDelivery {
  return {
    id: item.id,
    title: item.listing?.title ?? "—",
    reference: item.listing?.reference ?? null,
    origin: item.listing?.pickupCity ?? town(item.pickupAddress),
    destination: item.listing?.dropoffCity ?? town(item.dropoffAddress),
    status: item.status,
    price: item.priceCents,
    createdDate: item.createdAt,
    driverName: item.driverName,
  };
}

async function fetchAdminShipments(): Promise<PendingDelivery[]> {
  const response = await fetch("/api/admin/shipments");
  const json: ShipmentsApiResponse = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to fetch shipments");
  }

  return (json.data ?? []).map(toPendingDelivery);
}

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

/** Runs still under way — not delivered, not cancelled. */
export function usePendingShipments() {
  const query = useAdminShipments();

  const pendingShipments = (query.data || []).filter(
    (s) => s.status !== "DELIVERED" && s.status !== "CANCELLED"
  );

  return {
    ...query,
    data: pendingShipments,
  };
}
