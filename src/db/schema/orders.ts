import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { listings } from "./listings";
import { shipments } from "./shipments";

// ========================================
// Enums
// ========================================

export const orderStatusEnum = pgEnum("order_status", [
  "pending_address", // Winner needs to input delivery address
  "pending_proposals", // Waiting for driver proposals
  "pending_selection", // Waiting for admin to select driver
  "pending_payment", // Waiting for winner to pay
  "paid", // Payment confirmed
  "shipped", // Item picked up by driver
  "delivered", // Item delivered
  "cancelled", // Order cancelled
]);

// ========================================
// Orders Table
// ========================================

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),

    // Parties
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Related entities
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    shipmentId: text("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),

    // Pricing (in cents)
    itemPrice: integer("item_price").notNull(), // Final bid amount
    shippingPrice: integer("shipping_price"), // Set when driver selected
    totalPrice: integer("total_price"), // item + shipping

    // Status
    status: orderStatusEnum("status").default("pending_address").notNull(),

    // Delivery address (set by buyer)
    deliveryAddress: text("delivery_address"),
    deliveryLat: text("delivery_lat"),
    deliveryLng: text("delivery_lng"),

    // Payment info (mock for now)
    paidAt: timestamp("paid_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("order_buyer_idx").on(table.buyerId),
    index("order_seller_idx").on(table.sellerId),
    index("order_listing_idx").on(table.listingId),
    index("order_status_idx").on(table.status),
  ]
);

// ========================================
// Relations
// ========================================

export const ordersRelations = relations(orders, ({ one }) => ({
  buyer: one(user, {
    fields: [orders.buyerId],
    references: [user.id],
    relationName: "buyerOrders",
  }),
  seller: one(user, {
    fields: [orders.sellerId],
    references: [user.id],
    relationName: "sellerOrders",
  }),
  listing: one(listings, {
    fields: [orders.listingId],
    references: [listings.id],
  }),
  shipment: one(shipments, {
    fields: [orders.shipmentId],
    references: [shipments.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type OrderStatusType = (typeof orderStatusEnum.enumValues)[number];
