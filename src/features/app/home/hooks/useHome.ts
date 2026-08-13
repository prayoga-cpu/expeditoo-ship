import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPublicListings, type PublicListing } from "../api";
import type { Filters } from "../types";

/**
 * Custom hook for managing home page state and logic
 * Following rules.md:
 * - UI layer should not contain business logic
 * - All state management is here
 * - Uses TanStack Query for data fetching
 */
export function useHome() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    category: null,
    priceRange: [0, 500],
    sortBy: "ending_soon",
    sizes: [],
  });

  // Applied filters (only updated when user clicks Search or Apply Filters)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(filters);
  const [appliedSearch, setAppliedSearch] = useState("");

  // Fetch listings with TanStack Query
  // Uses polling (10s) instead of per-card Ably subscriptions for efficiency
  const {
    data: listings = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: [
      "public-listings",
      appliedSearch,
      appliedFilters.category,
      appliedFilters.priceRange,
      appliedFilters.sortBy,
      appliedFilters.sizes,
    ],
    queryFn: () =>
      fetchPublicListings({
        search: appliedSearch || undefined,
        category: appliedFilters.category || undefined,
        priceMin: appliedFilters.priceRange[0],
        priceMax: appliedFilters.priceRange[1],
        sortBy: appliedFilters.sortBy || "ending_soon",
        sizes:
          appliedFilters.sizes.length > 0
            ? appliedFilters.sizes.join(",")
            : undefined,
      }),
    // Poll every 10 seconds to keep bid prices fresh without Ably overhead
    refetchInterval: 10 * 1000,
    // Don't refetch on window focus (polling handles it)
    refetchOnWindowFocus: false,
  });

  // Transform PublicListing to Listing format for UI compatibility
  const transformedListings = listings.map((listing: PublicListing) => ({
    id: listing.id,
    title: listing.title,
    description: listing.description,
    imageUrl: listing.images[0]?.url || "https://placehold.co/600x400",
    category: listing.category.name,
    currentBid: (listing.currentPrice || listing.startPrice || 0) / 100,
    bids: listing.bidCount || 0,
    origin: {
      city: listing.city || "Unknown",
      zip: "",
      lat: listing.lat || 0,
      lng: listing.lng || 0,
    },
    destination: {
      city: "Anywhere",
      zip: "",
      lat: 0,
      lng: 0,
    },
    deadline:
      listing.endsAt ||
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: listing.createdAt,
    size: listing.size || "M",
    distance: "Local",
    status: "active" as const,
  }));

  // Apply search (trigger API call)
  const applySearch = () => {
    setAppliedSearch(searchQuery);
  };

  // Apply filters (trigger API call)
  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  // Clear all filters
  const clearFilters = () => {
    const defaultFilters: Filters = {
      search: "",
      category: null,
      priceRange: [0, 500],
      sortBy: "ending_soon",
      sizes: [],
    };
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setSearchQuery("");
    setAppliedSearch("");
  };

  return {
    searchQuery,
    setSearchQuery,
    showMap,
    setShowMap,
    filters,
    setFilters,
    listings: transformedListings,
    isLoading,
    isError,
    error,
    applySearch,
    applyFilters,
    clearFilters,
    refetch,
    isRefetching, // For pull-to-refresh indicator
  };
}
