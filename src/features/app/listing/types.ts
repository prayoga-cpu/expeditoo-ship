/**
 * Listing feature types
 * Following SOLID principle - centralized type definitions
 */

export type ListingCondition = "new" | "like-new" | "good" | "fair" | "poor";
export type ListingCategory = "electronics" | "furniture" | "clothing" | "sports" | "books" | "other";

export interface ListingImage {
  id: string;
  url: string;
  alt?: string;
}

export interface ListingSeller {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  reviewCount: number;
  joinedDate: string;
  verified: boolean;
}

export interface ListingLocation {
  address: string;
  city: string;
  postalCode: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  images: ListingImage[];
  category: ListingCategory;
  condition: ListingCondition;
  seller: ListingSeller;
  location: ListingLocation;
  createdAt: string;
  updatedAt: string;
  views: number;
  isFavorited?: boolean;
  isAvailable: boolean;
}

export interface ListingReview {
  id: string;
  rating: number;
  comment: string;
  author: {
    name: string;
    avatar?: string;
  };
  createdAt: string;
  helpful: number;
}
