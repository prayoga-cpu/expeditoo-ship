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
import { offers } from "./offers";

// ========================================
// Shipment Status Enum
// ========================================
// A shipment is the execution record, created when the shipper accepts an
// offer. Everything before that lives on the listing.

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "PENDING",
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

    // Provenance: the job and the winning bid.
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    offerId: text("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "restrict" }),

    // Parties
    shipperId: text("shipper_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    carrierId: text("carrier_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // The carrier's employee actually doing the run. Null until dispatched.
    driverId: text("driver_id").references(() => user.id, {
      onDelete: "set null",
    }),

    status: shipmentStatusEnum("status").default("PENDING").notNull(),

    // Route, copied from the listing so the record stays truthful even if the
    // listing is later edited.
    pickupLat: doublePrecision("pickup_lat").notNull(),
    pickupLng: doublePrecision("pickup_lng").notNull(),
    pickupAddress: text("pickup_address").notNull(),
    dropoffLat: doublePrecision("dropoff_lat").notNull(),
    dropoffLng: doublePrecision("dropoff_lng").notNull(),
    dropoffAddress: text("dropoff_address").notNull(),

    // Agreed terms, from the accepted offer.
    priceCents: integer("price_cents").notNull(),
    scheduledPickup: timestamp("scheduled_pickup"),
    scheduledDelivery: timestamp("scheduled_delivery"),

    // Proof of delivery
    proofOfDeliveryUrl: text("proof_of_delivery_url"),
    pickedUpAt: timestamp("picked_up_at"),
    deliveredAt: timestamp("delivered_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancellationReason: text("cancellation_reason"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("shipment_listing_idx").on(table.listingId),
    index("shipment_shipper_idx").on(table.shipperId),
    index("shipment_carrier_idx").on(table.carrierId),
    index("shipment_driver_idx").on(table.driverId),
    index("shipment_status_idx").on(table.status),
  ]
);

// ========================================
// Actor Role Enum (for shipment events)
// ========================================

export const actorRoleEnum = pgEnum("actor_role", [
  "system",
  "shipper",
  "carrier",
  "driver",
  "operator",
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
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorRole: actorRoleEnum("actor_role").notNull(),
    note: text("note"),
    // JSON string for flexibility (GPS coords, photo URL, etc).
    metadata: text("metadata"),
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
  listing: one(listings, {
    fields: [shipments.listingId],
    references: [listings.id],
  }),
  offer: one(offers, {
    fields: [shipments.offerId],
    references: [offers.id],
  }),
  shipper: one(user, {
    fields: [shipments.shipperId],
    references: [user.id],
    relationName: "shipperToShipments",
  }),
  carrier: one(user, {
    fields: [shipments.carrierId],
    references: [user.id],
    relationName: "carrierToShipments",
  }),
  driver: one(user, {
    fields: [shipments.driverId],
    references: [user.id],
    relationName: "driverToShipments",
  }),
  events: many(shipmentEvents),
}));

export const shipmentEventsRelations = relations(shipmentEvents, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentEvents.shipmentId],
    references: [shipments.id],
  }),
  actor: one(user, {
    fields: [shipmentEvents.actorId],
    references: [user.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;

export type ShipmentEvent = typeof shipmentEvents.$inferSelect;
export type InsertShipmentEvent = typeof shipmentEvents.$inferInsert;

export type ShipmentStatusType = (typeof shipmentStatusEnum.enumValues)[number];
export type ActorRoleType = (typeof actorRoleEnum.enumValues)[number];
