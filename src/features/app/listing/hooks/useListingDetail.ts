import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export interface ListingDetailData {
  id: string;
  title: string;
  price: number;
  status: string;
  sellerId: string;
  winnerId: string | null;
  sender: {
    name: string;
    id: string;
    rating: number;
    reviews: number;
  };
  origin: string;
  destination: string;
  dates: string;
  size: string;
  quantity: number;
  weight: string;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  description: string;
  images: string[];
}

// API response type
interface ApiListingResponse {
  success: boolean;
  data: {
    id: string;
    title: string;
    currentPrice?: number;
    startPrice?: number;
    status?: string;
    sellerId?: string;
    winnerId?: string | null;
    seller?: { id: string; name: string };
    city?: string;
    endsAt?: string;
    size?: string;
    description?: string;
    images?: { url: string }[];
  };
}

// Fetcher function for listings
async function fetchListingDetail(id: string): Promise<ListingDetailData> {
  const res = await fetch(`/api/listings/${id}`);
  const data: ApiListingResponse = await res.json();

  if (!data.success) {
    throw new Error("Failed to fetch listing");
  }

  const item = data.data;
  return {
    id: item.id,
    title: item.title,
    price: item.currentPrice || item.startPrice || 0,
    status: item.status || "active",
    sellerId: item.sellerId || item.seller?.id || "",
    winnerId: item.winnerId || null,
    sender: { name: item.seller?.name || "Seller Name", id: item.seller?.id || "", rating: 0, reviews: 0 },
    origin: `${item.city || "Unknown"}`,
    destination: "Anywhere",
    dates: item.endsAt ? new Date(item.endsAt).toLocaleDateString() : "Flexible",
    size: item.size || "M",
    quantity: 1,
    weight: "Unknown",
    dimensions: { length: 0, width: 0, height: 0 },
    description: item.description || "No description",
    images: item.images?.map((img) => img.url) || ["/image-not-found.svg"],
  };
}

export function useListingDetail(id: string) {
  const [showMore, setShowMore] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Use TanStack Query for data fetching (per docs/rules.md §6)
  const { data: listing, isLoading, error } = useQuery({
    queryKey: ["listings", id],
    queryFn: () => fetchListingDetail(id),
    enabled: !!id,
  });

  return {
    listing: listing ?? null,
    showMore,
    setShowMore,
    currentImageIndex,
    setCurrentImageIndex,
    isLoading,
    error,
  };
}
