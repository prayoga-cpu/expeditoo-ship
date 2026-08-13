/**
 * Notifications feature types
 * Following SOLID principle - centralized type definitions
 */

import type React from "react";

export type NotificationType =
  | "message"
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_invalidated"
  | "listing_expired"
  | "delivery"
  | "review"
  | "payment"
  | "listing"
  | "carrier_application"
  | "shipment_update"
  | "shipment_assigned";

export type NotificationTab = "all" | "unread" | "message";

export interface NotificationAction {
  label: string;
  href: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  // Icon can be either a React element or a component reference (e.g. lucide icons)
  icon: React.ElementType;
  link?: string;
  action?: NotificationAction;
}
