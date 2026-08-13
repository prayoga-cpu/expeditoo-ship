import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Proposal {
  id: string;
  driverId: string;
  price: number;
  message?: string | null;
  estimatedPickup?: string | null;
  estimatedDelivery?: string | null;
  createdAt: string;
  driver?: {
    id: string;
    name: string;
    image: string | null;
  };
}

// Fetch proposals from API
async function fetchProposals(shipmentId: string): Promise<Proposal[]> {
  const res = await fetch(`/api/shipments/${shipmentId}/proposals`);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || "Failed to fetch proposals");
  }
  return data.data || [];
}

// Accept proposal via API (admin selects driver)
async function acceptProposal(shipmentId: string, proposalId: string) {
  const res = await fetch(
    `/api/shipments/${shipmentId}/proposals/${proposalId}/select`,
    {
      method: "POST",
    }
  );
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || "Failed to accept proposal");
  }
  return data.data;
}

export function useShipmentProposals(
  shipmentId: string | null,
  enabled: boolean
) {
  const queryClient = useQueryClient();

  // Fetch proposals
  const proposalsQuery = useQuery({
    queryKey: ["proposals", shipmentId],
    queryFn: () => fetchProposals(shipmentId!),
    enabled: !!shipmentId && enabled,
  });

  // Accept proposal mutation
  const acceptMutation = useMutation({
    mutationFn: ({
      shipmentId,
      proposalId,
    }: {
      shipmentId: string;
      proposalId: string;
    }) => acceptProposal(shipmentId, proposalId),
    onSuccess: () => {
      toast.success("Driver assigned successfully!");
      queryClient.invalidateQueries({ queryKey: ["proposals", shipmentId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "shipments"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to assign driver");
    },
  });

  return {
    proposals: proposalsQuery.data || [],
    isLoading: proposalsQuery.isLoading,
    isError: proposalsQuery.isError,
    acceptProposal: acceptMutation.mutate,
    isAccepting: acceptMutation.isPending,
  };
}
