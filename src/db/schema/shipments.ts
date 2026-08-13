import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  integer,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { listings } from "./listings";

// ========================================
// Shipment Status Enum
// ========================================

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "PENDING",
  "PRICE_PROPOSED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
]);

// ========================================
// Shipments Table
// ========================================

export const shipments = pgTable(
  "shipments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    listingId: text("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
    driverId: text("driver_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: shipmentStatusEnum("status").default("PENDING").notNull(),

    // Origin
    originLat: doublePrecision("origin_lat").notNull(),
    originLng: doublePrecision("origin_lng").notNull(),
    originAddress: text("origin_address").notNull(),

    // Destination
    destinationLat: doublePrecision("destination_lat").notNull(),
    destinationLng: doublePrecision("destination_lng").notNull(),
    destinationAddress: text("destination_address").notNull(),

    // Package Details
    packageWeight: doublePrecision("package_weight"),
    packageDimensions: text("package_dimensions"),
    packageDescription: text("package_description"),

    // Scheduling & Pricing
    scheduledDate: timestamp("scheduled_date"),
    price: integer("price"),

    // Proof of Delivery
    proofOfDeliveryUrl: text("proof_of_delivery_url"),
    deliveredAt: timestamp("delivered_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("shipment_user_idx").on(table.userId),
    index("shipment_driver_idx").on(table.driverId),
    index("shipment_status_idx").on(table.status),
  ]
);

// ========================================
// Shipment Proposals Table
// ========================================

export const shipmentProposals = pgTable(
  "shipment_proposals",
  {
    id: text("id").primaryKey(),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    driverId: text("driver_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    price: integer("price").notNull(),
    estimatedPickup: timestamp("estimated_pickup"),
    estimatedDelivery: timestamp("estimated_delivery"),
    message: text("message"),
    status: text("status").default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("proposal_shipment_idx").on(table.shipmentId),
    index("proposal_driver_idx").on(table.driverId),
  ]
);

// ========================================
// Actor Role Enum (for shipment events)
// ========================================

export const actorRoleEnum = pgEnum("actor_role", [
  "system",
  "driver",
  "buyer",
  "seller",
  "admin",
]);

// ========================================
// Shipment Events Table (Timeline History)
// ========================================

export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: text("id").primaryKey(),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    status: shipmentStatusEnum("status").notNull(),
    previousStatus: shipmentStatusEnum("previous_status"),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorRole: actorRoleEnum("actor_role").notNull(),
    note: text("note"),
    metadata: text("metadata"), // JSON string for flexibility (GPS coords, photo URL, etc)
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("shipment_events_shipment_idx").on(table.shipmentId),
    index("shipment_events_status_idx").on(table.status),
  ]
);

// ========================================
// Relations
// ========================================

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  user: one(user, {
    fields: [shipments.userId],
    references: [user.id],
    relationName: "userToShipments",
  }),
  listing: one(listings, {
    fields: [shipments.listingId],
    references: [listings.id],
  }),
  driver: one(user, {
    fields: [shipments.driverId],
    references: [user.id],
    relationName: "driverToShipments",
  }),
  proposals: many(shipmentProposals),
  events: many(shipmentEvents),
}));

export const shipmentProposalsRelations = relations(
  shipmentProposals,
  ({ one }) => ({
    shipment: one(shipments, {
      fields: [shipmentProposals.shipmentId],
      references: [shipments.id],
    }),
    driver: one(user, {
      fields: [shipmentProposals.driverId],
      references: [user.id],
    }),
  })
);

export const shipmentEventsRelations = relations(
  shipmentEvents,
  ({ one }) => ({
    shipment: one(shipments, {
      fields: [shipmentEvents.shipmentId],
      references: [shipments.id],
    }),
    actor: one(user, {
      fields: [shipmentEvents.actorId],
      references: [user.id],
    }),
  })
);

// ========================================
// Type Exports
// ========================================

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;

export type ShipmentProposal = typeof shipmentProposals.$inferSelect;
export type InsertShipmentProposal = typeof shipmentProposals.$inferInsert;

export type ShipmentEvent = typeof shipmentEvents.$inferSelect;
export type InsertShipmentEvent = typeof shipmentEvents.$inferInsert;

// Status type
export type ShipmentStatusType = typeof shipmentStatusEnum.enumValues[number];

// Actor role type
export type ActorRoleType = typeof actorRoleEnum.enumValues[number];
