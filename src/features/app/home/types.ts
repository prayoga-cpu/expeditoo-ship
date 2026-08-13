/**
 * Home feature types
 * Following rules.md - type definitions for home feature
 */

export interface Listing {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  currentBid: number;
  bids: number;
  origin: {
    city: string;
    zip: string;
    lat: number;
    lng: number;
  };
  destination: {
    city: string;
    zip: string;
    lat: number;
    lng: number;
  };
  deadline: string; // ISO string for easier sorting
  createdAt: string; // ISO string
  size: string;
  distance: string;
  status: "active" | "hot";
}

export interface Filters {
  search: string;
  category: string | null;
  priceRange: [number, number];
  sortBy: "ending_soon" | "newest" | "price_low" | "price_high" | null;
  sizes: string[]; // Keeping this as it might be useful
}
