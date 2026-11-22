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

/**
 * Which side of the delivery the reviewed person was on. A review is written
 * by the other party (`reviews.role` records the author's side), so one a
 * requester wrote is one received **as a transporter**, and the reverse.
 */
export type ReviewType = "requester" | "carrier";

export interface Review {
  id: string;
  author: string;
  rating: number;
  title: string;
  content: string;
  timestamp: string;
  type: ReviewType;
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

export type ReviewTab = "all" | ReviewType;

// Matches backend UserPreferences
export interface NotificationSettings {
  email: {
    auctionResults: boolean;
    marketing: boolean;
  };
}
