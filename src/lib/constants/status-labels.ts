/**
 * Centralized Status Labels
 * 
 * All user-facing status labels are defined here to ensure consistency
 * across the application and enable future i18n support.
 */

// ========================================
// Shipment Status Labels
// ========================================

export const SHIPMENT_STATUS_LABELS = {
    PENDING: "Shipment created",
    PRICE_PROPOSED: "Price proposed",
    ASSIGNED: "Driver assigned",
    PICKED_UP: "Package picked up",
    IN_TRANSIT: "In transit",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
} as const;

export type ShipmentStatusKey = keyof typeof SHIPMENT_STATUS_LABELS;

export function getShipmentStatusLabel(status: ShipmentStatusKey): string {
    return SHIPMENT_STATUS_LABELS[status] || status;
}

// ========================================
// Order Status Labels
// ========================================

export const ORDER_STATUS_LABELS = {
    pending_address: "Waiting for delivery address",
    pending_proposals: "Waiting for driver proposals",
    pending_selection: "Waiting for driver selection",
    pending_payment: "Waiting for payment",
    paid: "Payment confirmed",
    shipped: "In transit",
    delivered: "Delivered",
    cancelled: "Cancelled",
} as const;

export type OrderStatusKey = keyof typeof ORDER_STATUS_LABELS;

export function getOrderStatusLabel(status: OrderStatusKey): string {
    return ORDER_STATUS_LABELS[status] || status;
}

// ========================================
// Notification Type Labels
// ========================================

export const NOTIFICATION_TYPE_LABELS = {
    bid: "Bid",
    listing: "Listing",
    message: "Message",
    delivery: "Delivery",
    review: "Review",
    payment: "Payment",
} as const;

export type NotificationTypeKey = keyof typeof NOTIFICATION_TYPE_LABELS;

// ========================================
// User Role Labels
// ========================================

/** The canonical seven (`userRoleEnum`). Previously the v1 goods-marketplace set. */
export const USER_ROLE_LABELS = {
    shipper: "Shipper",
    carrier: "Carrier",
    driver: "Driver",
    operator: "Operator",
    support: "Support",
    finance: "Finance",
    admin: "Administrator",
} as const;

export type UserRoleKey = keyof typeof USER_ROLE_LABELS;

export function getUserRoleLabel(role: UserRoleKey): string {
    return USER_ROLE_LABELS[role] || role;
}

// ========================================
// Driver Application Status Labels
// ========================================

export const DRIVER_APPLICATION_STATUS_LABELS = {
    PENDING: "Pending Review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
} as const;

export type DriverApplicationStatusKey = keyof typeof DRIVER_APPLICATION_STATUS_LABELS;

// ========================================
// Listing Condition Labels
// ========================================

export const LISTING_CONDITION_LABELS = {
    new: "New",
    like_new: "Like New",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
} as const;

// ========================================
// Listing Type Labels
// ========================================

export const LISTING_TYPE_LABELS = {
    auction: "Auction",
    direct_sale: "Direct Sale",
} as const;

// ========================================
// Listing Status Labels
// ========================================

export const LISTING_STATUS_LABELS = {
    active: "Active",
    sold: "Sold",
    ended: "Ended",
    cancelled: "Cancelled",
} as const;

// ========================================
// Proposal Status Labels
// ========================================

export const PROPOSAL_STATUS_LABELS = {
    pending: "Pending",
    accepted: "Accepted",
    rejected: "Rejected",
} as const;
