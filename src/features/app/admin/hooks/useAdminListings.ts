import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ListingStatus } from "@/features/app/listing/types";

// ========================================
// Types
// ========================================

export interface AdminListing {
  id: string;
  title: string;
  shipper: {
    name: string;
    email: string;
  };
  budgetCents: number;
  status: ListingStatus;
  createdAt: string;
  views: number;
}

interface ListingsApiResponse {
  success: boolean;
  data?: {
    items: Array<{
      id: string;
      title: string;
      shipper?: { name?: string | null; email?: string | null } | null;
      budgetCents: number;
      status: ListingStatus;
      createdAt: string;
      views: number;
    }>;
    total: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ========================================
// Fetch Functions
// ========================================

async function fetchAdminListings(): Promise<AdminListing[]> {
  const response = await fetch("/api/admin/listings");
  const json: ListingsApiResponse = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to fetch listings");
  }

  return (json.data?.items || []).map((item) => ({
    id: item.id,
    title: item.title,
    shipper: {
      name: item.shipper?.name || "Unknown",
      email: item.shipper?.email || "",
    },
    budgetCents: item.budgetCents,
    status: item.status,
    createdAt: item.createdAt,
    views: item.views,
  }));
}

async function deleteListingApi(id: string): Promise<void> {
  const response = await fetch(`/api/listings/${id}`, {
    method: "DELETE",
  });
  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to delete listing");
  }
}

// ========================================
// Hook
// ========================================

export function useAdminListings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin", "listings"],
    queryFn: fetchAdminListings,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteListingApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "listings"] });
      toast.success("Listing deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete listing: ${error.message}`);
    },
  });

  return {
    ...query,
    deleteListing: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
