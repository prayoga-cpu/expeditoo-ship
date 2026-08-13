import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelShipment } from "../api";

/**
 * Custom hook for cancelling a shipment
 */
export function useCancelShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cancelShipment(id, reason),
    onSuccess: (_, variables) => {
      // Invalidate shipment queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["shipment", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
    },
  });
}
