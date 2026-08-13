import { z } from "zod";
import { shipmentStatusEnum } from "@/db/schema/shipments";

// ========================================
// Status Types & Validation
// ========================================

export const ShipmentStatus = shipmentStatusEnum.enumValues;
export type ShipmentStatusType = (typeof ShipmentStatus)[number];

// Valid status transitions (state machine)
export const VALID_STATUS_TRANSITIONS: Record<
  ShipmentStatusType,
  ShipmentStatusType[]
> = {
  PENDING: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED"], // Relaxed for flexibility
  PICKED_UP: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "PICKED_UP"], // Allow rollback if mistake
  DELIVERED: [],
  CANCELLED: [],
};

// ========================================
// Input DTOs
// ========================================

// Location schema (for API spec format)
const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(5).max(500),
});

// Package details schema (for API spec format)
const packageDetailsSchema = z.object({
  weight: z.number().positive().optional(),
  dimensions: z.string().max(50).optional(), // "10x10x10"
  description: z.string().max(500).optional(),
});

// Create Shipment - API Spec Format (nested objects)
// Per API spec: origin, destination, packageDetails, scheduledDate
export const createShipmentSchema = z.object({
  listingId: z.string().optional(),

  // Origin location (nested per API spec)
  origin: locationSchema,

  // Destination location (nested per API spec)
  destination: locationSchema,

  // Package details (nested per API spec)
  packageDetails: packageDetailsSchema.optional(),

  // Scheduling
  scheduledDate: z.coerce.date().optional(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

// Internal format (flat structure, used by service/DAL)
export interface CreateShipmentInternal {
  listingId?: string;
  originLat: number;
  originLng: number;
  originAddress: string;
  destinationLat: number;
  destinationLng: number;
  destinationAddress: string;
  packageWeight?: number;
  packageDimensions?: string;
  packageDescription?: string;
  scheduledDate?: Date;
}

/**
 * Transform API spec format to internal format
 */
export function transformToInternalFormat(
  input: CreateShipmentInput
): CreateShipmentInternal {
  return {
    listingId: input.listingId,
    originLat: input.origin.lat,
    originLng: input.origin.lng,
    originAddress: input.origin.address,
    destinationLat: input.destination.lat,
    destinationLng: input.destination.lng,
    destinationAddress: input.destination.address,
    packageWeight: input.packageDetails?.weight,
    packageDimensions: input.packageDetails?.dimensions,
    packageDescription: input.packageDetails?.description,
    scheduledDate: input.scheduledDate,
  };
}

// Update Status
export const updateShipmentStatusSchema = z.object({
  status: z.enum(ShipmentStatus),
  note: z.string().max(500).optional(),
});

export type UpdateShipmentStatusInput = z.infer<
  typeof updateShipmentStatusSchema
>;

// Assign Driver
export const assignDriverSchema = z.object({
  driverId: z.string().min(1),
  price: z.number().int().positive(), // Price in cents
});

export type AssignDriverInput = z.infer<typeof assignDriverSchema>;

// Cancel Shipment
export const cancelShipmentSchema = z.object({
  reason: z.string().min(5).max(500),
});

export type CancelShipmentInput = z.infer<typeof cancelShipmentSchema>;

// Create Proposal (Driver submits a price proposal)
export const createProposalSchema = z.object({
  price: z.number().int().positive(), // Price in cents
  estimatedPickup: z.coerce.date().optional(),
  estimatedDelivery: z.coerce.date().optional(),
  message: z.string().max(500).optional(),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;

// Proposal status
export const ProposalStatus = ["pending", "accepted", "rejected"] as const;
export type ProposalStatusType = (typeof ProposalStatus)[number];

// Upload Proof of Delivery
export const uploadProofOfDeliverySchema = z.object({
  note: z.string().max(500).optional(),
});

export type UploadProofOfDeliveryInput = z.infer<
  typeof uploadProofOfDeliverySchema
>;

// ========================================
// Query DTOs
// ========================================

// Per API spec: GET /api/shipments uses query params: status, role (driver/sender)
export const getShipmentsQuerySchema = z.object({
  role: z.enum(["sender", "driver", "available", "proposals", "buyer", "seller"]).optional(), // Per API spec: role (driver/sender/available/proposals/buyer/seller)
  status: z.enum(ShipmentStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type GetShipmentsQuery = z.infer<typeof getShipmentsQuerySchema>;

// ========================================
// Output DTOs
// ========================================

// Listing summary for shipment
export const shipmentListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  image: z.string().nullable(),
});

// User summary
export const shipmentUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

// Driver summary (extends user with phone)
export const shipmentDriverSchema = shipmentUserSchema.extend({
  phone: z.string().nullable().optional(),
});

// Timeline event
export const shipmentTimelineEventSchema = z.object({
  status: z.enum(ShipmentStatus),
  timestamp: z.date(),
  description: z.string(),
});

// ========================================
// Shipment Events (Real Timeline)
// ========================================

export const createShipmentEventSchema = z.object({
  shipmentId: z.string(),
  status: z.enum(ShipmentStatus),
  previousStatus: z.enum(ShipmentStatus).optional(),
  actorId: z.string().optional(),
  actorRole: z.enum(["system", "driver", "buyer", "seller", "admin"]),
  note: z.string().optional(),
  metadata: z.string().optional(), // JSON string
});

export type CreateShipmentEventInternal = z.infer<
  typeof createShipmentEventSchema
>;

// Timeline item for API response (Enhanced with actor info)
export const shipmentTimelineItemSchema = z.object({
  status: z.enum(ShipmentStatus),
  timestamp: z.date(),
  description: z.string(),
  actor: z
    .object({
      id: z.string(),
      name: z.string(),
      image: z.string().nullable(),
      role: z.string(),
    })
    .optional(),
  note: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ShipmentTimelineItem = z.infer<typeof shipmentTimelineItemSchema>;

// Shipment list item (summary)
export const shipmentListItemSchema = z.object({
  id: z.string(),
  status: z.enum(ShipmentStatus),
  originAddress: z.string(),
  destinationAddress: z.string(),
  scheduledDate: z.date().nullable(),
  price: z.number().nullable(),
  listing: shipmentListingSchema.nullable(),
  driver: shipmentUserSchema.nullable(),
  createdAt: z.date(),
});

export type ShipmentListItem = z.infer<typeof shipmentListItemSchema>;

// Shipment detail (full)
export const shipmentDetailSchema = z.object({
  id: z.string(),
  status: z.enum(ShipmentStatus),

  // Locations
  originLat: z.number(),
  originLng: z.number(),
  originAddress: z.string(),
  destinationLat: z.number(),
  destinationLng: z.number(),
  destinationAddress: z.string(),

  // Package
  packageWeight: z.number().nullable(),
  packageDimensions: z.string().nullable(),
  packageDescription: z.string().nullable(),

  // Scheduling & Pricing
  scheduledDate: z.date().nullable(),
  price: z.number().nullable(),

  // Relations
  listing: shipmentListingSchema.nullable(),
  user: shipmentUserSchema,
  driver: shipmentDriverSchema.nullable(),

  // Timeline (computed)
  timeline: z.array(shipmentTimelineItemSchema),

  // Proof of Delivery
  proofOfDeliveryUrl: z.string().nullable(),
  deliveredAt: z.date().nullable(),

  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ShipmentDetail = z.infer<typeof shipmentDetailSchema>;

// ========================================
// Response DTOs
// ========================================

export const shipmentsListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(shipmentListItemSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  }),
});

export const shipmentDetailResponseSchema = z.object({
  success: z.literal(true),
  data: shipmentDetailSchema,
});

export const shipmentErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

// ========================================
// Helper Functions
// ========================================

/**
 * Validate if a status transition is allowed
 */
export function isValidStatusTransition(
  currentStatus: ShipmentStatusType,
  newStatus: ShipmentStatusType
): boolean {
  return VALID_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}

/**
 * Get human-readable status label (for timeline)
 */
export function getStatusLabel(status: ShipmentStatusType): string {
  const labels: Record<ShipmentStatusType, string> = {
    PENDING: "deliveries.events.PENDING",
    ASSIGNED: "deliveries.events.ASSIGNED",
    PICKED_UP: "deliveries.events.PICKED_UP",
    IN_TRANSIT: "deliveries.events.IN_TRANSIT",
    DELIVERED: "deliveries.events.DELIVERED",
    CANCELLED: "deliveries.events.CANCELLED",
  };
  return labels[status];
}

/**
 * Check if shipment can be cancelled
 */
export function canCancelShipment(status: ShipmentStatusType): boolean {
  // Cannot cancel if already picked up, in transit, or delivered
  return !["PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED"].includes(
    status
  );
}


