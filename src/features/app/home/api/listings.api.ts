/**
 * Client API for Listings
 * Typed wrapper for REST API calls
 */

export interface FetchPublicListingsParams {
  search?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  sortBy?: "ending_soon" | "newest" | "price_low" | "price_high";
  sizes?: string; // Comma-separated
}

export interface PublicListing {
  id: string;
  title: string;
  description: string;
  images: Array<{
    id: string;
    url: string;
    order: number;
  }>;
  category: {
    id: string;
    name: string;
  };
  condition: string;
  type: string;
  status: string;
  startPrice: number | null;
  currentPrice: number | null;
  buyNowPrice: number | null;
  size: string | null;
  weight: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  address: string | null;
  endsAt: string | null;
  createdAt: string;
  seller: {
    id: string;
    name: string;
    image: string | null;
  };
  bidCount: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Fetch public listings with optional filters
 */
export async function fetchPublicListings(
  params?: FetchPublicListingsParams
): Promise<PublicListing[]> {
  // Build query string
  const queryParams = new URLSearchParams();

  if (params?.search) queryParams.set("search", params.search);
  if (params?.category) queryParams.set("category", params.category);
  if (params?.priceMin !== undefined)
    queryParams.set("priceMin", params.priceMin.toString());
  if (params?.priceMax !== undefined)
    queryParams.set("priceMax", params.priceMax.toString());
  if (params?.sortBy) queryParams.set("sortBy", params.sortBy);
  if (params?.sizes) queryParams.set("sizes", params.sizes);

  const url = `/api/listings/public${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch listings: ${response.statusText}`);
  }

  const result: ApiResponse<PublicListing[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch listings");
  }

  return result.data;
}
