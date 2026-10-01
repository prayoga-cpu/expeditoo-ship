import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ListingStatus } from "@/features/app/listing/types";
import {
  adminListingsApi,
  type AdminListingRow,
  type ListingOrigin,
} from "../api/listings.api";

// ========================================
// Types
// ========================================

export interface AdminListing {
  id: string;
  reference: number;
  title: string;
  shipper: {
    name: string;
    email: string;
  };
  budgetCents: number;
  status: ListingStatus;
  origin: ListingOrigin;
  pickupCity: string;
  dropoffCity: string;
  createdAt: string;
  views: number;
}

export const adminListingKeys = {
  all: ["admin", "listings"] as const,
  recentDirect: (limit: number) =>
    ["admin", "listings", "recent-direct", limit] as const,
};

/** One row as the admin surfaces read it: the shipper join flattened, never null. */
export function toAdminListing(row: AdminListingRow): AdminListing {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    shipper: {
      name: row.shipper?.name || "Unknown",
      email: row.shipper?.email || "",
    },
    budgetCents: row.budgetCents,
    status: row.status,
    origin: row.origin,
    pickupCity: row.pickupCity,
    dropoffCity: row.dropoffCity,
    createdAt: row.createdAt,
    views: row.views,
  };
}

// ========================================
// Hooks
// ========================================

export function useAdminListings() {
  const queryClient = useQueryClient();

  // Refetched on every mount. This used to keep a five-minute cache with
  // `refetchOnMount: false`, so an admin who had opened Annonces before a
  // request was posted went on seeing the list without it — one of the two
  // reasons a new direct request looked missing (request_summary_spec.md §3.3).
  const query = useQuery({
    queryKey: adminListingKeys.all,
    queryFn: async () =>
      (await adminListingsApi.list()).items.map(toAdminListing),
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: adminListingsApi.remove,
    onSuccess: () => {
      // Prefix match: also refreshes Supervision's direct-requests panel.
      queryClient.invalidateQueries({ queryKey: adminListingKeys.all });
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

/**
 * The newest requests posted at `/create`, with how many there are in all,
 * for Supervision's "Demandes directes" panel (request_summary_spec.md §3.2).
 */
export function useRecentDirectRequests(limit = 5) {
  return useQuery({
    queryKey: adminListingKeys.recentDirect(limit),
    queryFn: async () => {
      const page = await adminListingsApi.list({ origin: "direct", limit });
      return { items: page.items.map(toAdminListing), total: page.total };
    },
    staleTime: 0,
  });
}
