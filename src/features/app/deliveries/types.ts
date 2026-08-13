/**
 * Deliveries feature types
 * Following SOLID principle - centralized type definitions
 */

export type DeliveryStatus =
  | "pending"
  | "accepted"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "cancelled";

export interface Delivery {
  id: string;
  title: string;
  origin: string;
  destination: string;
  dates: string;
  status: DeliveryStatus;
  driver?: string;
  price: number;
}

export type DeliveryTab = "incoming" | "outgoing";

export interface DeliveriesData {
  incoming: Delivery[];
  outgoing: Delivery[];
}

// Delivery Detail types
export interface Driver {
  id?: string;
  name: string;
  rating: number;
  reviews: number;
  phone: string;
  email: string;
  avatar: string;
  vehicle: string;
}

export type TimelineStatus = "completed" | "active" | "pending";

export interface TimelineEvent {
  label: string;
  date: string;
  status: TimelineStatus;
  icon: string;
}

export interface DeliveryDetailData {
  id: string;
  listingId: string | null; // Reference to listing for messaging context
  title: string;
  status: DeliveryStatus;
  price: number;
  origin: string;
  destination: string;
  dates: string;
  driver: Driver;
  userId: string; // The client ID who created the shipment
  timeline: TimelineEvent[];
  hasReviewed: boolean; // Whether current user has already reviewed
}
