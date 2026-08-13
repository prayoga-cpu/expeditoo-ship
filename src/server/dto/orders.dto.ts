import { z } from "zod";
import { orderStatusEnum } from "@/db/schema/orders";

// ========================================
// Status Types
// ========================================

export const OrderStatus = orderStatusEnum.enumValues;
export type OrderStatusType = (typeof OrderStatus)[number];

// ========================================
// Input DTOs
// ========================================

export type CreateOrderDTO = {
  listingId: string;
  sellerId: string;
  itemPrice: number;
  status: OrderStatusType;
  buyerId: string;
};

export type UpdateOrderDTO = Partial<CreateOrderDTO>;

export type OrderResponseDTO = OrderSummary; // Alias for now

export type OrderListDTO = {
  status?: OrderStatusType;
  limit?: number;
  offset?: number;
};

export type OrderListResponseDTO = {
  data: OrderResponseDTO[];
  total: number;
};

// Set delivery address
export const setDeliveryAddressSchema = z.object({
  address: z.string().min(5).max(500),
  lat: z.string().optional(),
  lng: z.string().optional(),
});

export type SetDeliveryAddressInput = z.infer<typeof setDeliveryAddressSchema>;

// Confirm payment (mock)
export const confirmPaymentSchema = z.object({
  paymentMethod: z.string().optional(), // For future Stripe integration
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

// ========================================
// Output DTOs
// ========================================

// Order summary for checkout
export const orderSummarySchema = z.object({
  id: z.string(),
  status: z.enum(OrderStatus),

  // Listing info
  listing: z.object({
    id: z.string(),
    title: z.string(),
    image: z.string().nullable(),
  }),

  // Seller info
  seller: z.object({
    id: z.string(),
    name: z.string().nullable(),
    image: z.string().nullable(),
  }),

  // Pricing
  itemPrice: z.number(),
  shippingPrice: z.number().nullable(),
  totalPrice: z.number().nullable(),

  // Delivery
  deliveryAddress: z.string().nullable(),
  originAddress: z.string().nullable(),

  // Driver info (if selected)
  driver: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      image: z.string().nullable(),
    })
    .nullable(),

  // Shipment status
  shipmentId: z.string().nullable(),
  shipmentStatus: z.string().nullable(),

  createdAt: z.date(),
});

export type OrderSummary = z.infer<typeof orderSummarySchema>;

// Order list item
export const orderListItemSchema = z.object({
  id: z.string(),
  status: z.enum(OrderStatus),
  listing: z.object({
    id: z.string(),
    title: z.string(),
    image: z.string().nullable(),
  }),
  itemPrice: z.number(),
  totalPrice: z.number().nullable(),
  createdAt: z.date(),
});

export type OrderListItem = z.infer<typeof orderListItemSchema>;

// ========================================
// Helper Functions
// ========================================

export function getOrderStatusLabel(status: OrderStatusType): string {
  const labels: Record<OrderStatusType, string> = {
    pending_address: "Waiting for delivery address",
    pending_proposals: "Waiting for driver proposals",
    pending_selection: "Waiting for driver selection",
    pending_payment: "Waiting for payment",
    paid: "Payment confirmed",
    shipped: "In transit",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return labels[status];
}

export function canSetDeliveryAddress(status: OrderStatusType): boolean {
  return status === "pending_address";
}

export function canConfirmPayment(status: OrderStatusType): boolean {
  return status === "pending_payment";
}
