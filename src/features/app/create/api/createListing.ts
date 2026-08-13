import { CreateListingInput } from "@/server/dto/listings.dto";

export async function createListing(data: CreateListingInput) {
  const response = await fetch("/api/listings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to create listing");
  }

  return await response.json();
}

export async function updateListing(id: string, data: CreateListingInput) {
  const response = await fetch(`/api/listings/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to update listing");
  }

  return await response.json();
}

export interface ApiListing {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  condition: string;
  type: string;
  startPrice: number;
  buyNowPrice?: number;
  length?: number;
  width?: number;
  height?: number;
  weight?: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  images?: { url: string }[];
}

export async function fetchListingById(id: string): Promise<ApiListing> {
  const response = await fetch(`/api/listings/${id}`);
  const data = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error?.message || "Failed to load listing");
  }

  return data.data;
}
