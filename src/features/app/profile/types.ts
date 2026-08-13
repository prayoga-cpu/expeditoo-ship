/**
 * Profile feature types
 * Following SOLID principle - centralized type definitions
 */

export interface UserProfile {
  name: string;
  rating: number;
  reviews: number;
  type: string;
  co2Saved: number;
  avatar: string;
}

export type ReviewType = "buyer" | "seller";

export interface Review {
  id: string;
  author: string;
  rating: number;
  title: string;
  content: string;
  timestamp: string;
  type: ReviewType;
  helpful: number;
}

export interface ReviewStats {
  average: number;
  total: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export type ReviewTab = "all" | "buyer" | "seller";

// Matches backend UserPreferences
export interface NotificationSettings {
  email: {
    auctionResults: boolean;
    marketing: boolean;
  };
}
