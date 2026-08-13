import { useQuery } from "@tanstack/react-query";
import { useTabState } from "@/features/app/common/hooks";
import {
  fetchShipments,
  fetchShipmentDetail,
  type ShipmentListItem,
} from "@/features/app/deliveries/api";

export type DriverShipmentTab = "available" | "my-shipments";

/**
 * Custom hook for managing driver shipments
 */
export function useDriverShipments() {
  const { activeTab, setActiveTab } =
    useTabState<DriverShipmentTab>("available");

  // Fetch available shipments (PENDING)
  const {
    data: availableData,
    isLoading: isLoadingAvailable,
    isError: isErrorAvailable,
    error: errorAvailable,
  } = useQuery({
    queryKey: ["shipments", "available"],
    queryFn: () => fetchShipments({ type: "available" }),
  });

  // Fetch my shipments (assigned to driver)
  const {
    data: myShipmentsData,
    isLoading: isLoadingMyShipments,
    isError: isErrorMyShipments,
    error: errorMyShipments,
  } = useQuery({
    queryKey: ["shipments", "driver"],
    queryFn: () => fetchShipments({ type: "driver" }),
  });

  // Fetch my proposals (shipments I've bid on but not yet assigned)
  const { data: myProposalsData, isLoading: isLoadingProposals } = useQuery({
    queryKey: ["shipments", "proposals"],
    queryFn: () => fetchShipments({ type: "proposals" }),
  });

  // Combine assigned shipments and proposals with deduplication
  const allShipments = [
    ...(myShipmentsData?.data || []),
    ...(myProposalsData?.data || []),
  ];

  const uniqueShipmentsMap = new Map<string, ShipmentListItem>();
  allShipments.forEach((shipment) => {
    uniqueShipmentsMap.set(shipment.id, shipment);
  });

  const combinedShipments = Array.from(uniqueShipmentsMap.values());

  return {
    activeTab,
    setActiveTab,
    availableShipments: availableData?.data || [],
    myShipments: combinedShipments,
    isLoading: isLoadingAvailable || isLoadingMyShipments || isLoadingProposals,
    isError: isErrorAvailable || isErrorMyShipments,
    error: (errorAvailable || errorMyShipments) as Error | null,
  };
}

/**
 * Custom hook for fetching single shipment detail for driver
 */
export function useDriverShipmentDetail(id: string) {
  const {
    data: shipment,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["shipment", id],
    queryFn: () => fetchShipmentDetail(id),
    enabled: !!id,
  });

  return {
    shipment,
    isLoading,
    isError,
    error: error as Error | null,
  };
}
