import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ========================================
// Types
// ========================================

interface ListingSeller {
  id: string;
  name: string;
  email: string;
}

interface AdminListing {
  id: string;
  title: string;
  user: {
    name: string;
    email: string;
  };
  price: number;
  status: "active" | "sold" | "ended" | "cancelled";
  createdAt: string;
  views: number;
}

interface ListingsApiResponse {
  success: boolean;
  data?: {
    items: Array<{
      id: string;
      title: string;
      seller?: ListingSeller;
      sellerId: string;
      currentPrice?: number | null;
      buyNowPrice?: number | null;
      startPrice?: number | null;
      status: string;
      createdAt: string;
      views: number;
    }>;
    total: number;
    page: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ========================================
// Fetch Functions
// ========================================

async function fetchAdminListings(_search?: string): Promise<AdminListing[]> {
  const response = await fetch("/api/admin/listings");
  const json: ListingsApiResponse = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to fetch listings");
  }

  // Map API response to AdminListing format
  return (json.data?.items || []).map((item) => ({
    id: item.id,
    title: item.title,
    user: {
      name: item.seller?.name || "Unknown",
      email: item.seller?.email || "",
    },
    price:
      (item.currentPrice || item.buyNowPrice || item.startPrice || 0) / 100,
    status: item.status as "active" | "sold" | "ended" | "cancelled",
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

export function useAdminListings(search?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin", "listings", search],
    queryFn: () => fetchAdminListings(search),
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
