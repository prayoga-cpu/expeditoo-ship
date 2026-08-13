/**
 * Auction feature types
 * Following SOLID principle - centralized type definitions
 */

export interface Bid {
  bidder: string;
  amount: number;
  time: string;
  avatar?: string;
}

export interface AuctionLocation {
  address: string;
  city: string;
  zip: string;
}

export interface AuctionSeller {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  joined: string;
  avatar: string;
}

export type AuctionStatus = "active" | "ended" | "pending";

export interface Auction {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  condition: string;
  currentBid: number;
  deadline: string;
  status: AuctionStatus;
  minimumIncrease: number;
  bidCount: number;
  location: AuctionLocation;
  seller: AuctionSeller;
}
