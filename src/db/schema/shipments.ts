import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  integer,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  CANCELLATION_CATEGORIES,
  CANCELLATION_SIDES,
} from "@/lib/cancellation-policy";
import { user } from "./users";
import { listings } from "./listings";
import { offers } from "./offers";
import { conversations } from "./messages";

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
// Cancellation Enums
// ========================================
// There are two verbs, and the schema has to tell them apart: a requester
// calling the job off ends it, a transporter backing out does not.
// See docs/specs/cancellations_spec.md §3.

/**
 * Both are **derived** from `src/lib/cancellation-policy.ts`, never restated —
 * the same arrangement as `TIME_SLOTS`/`timeSlotEnum`. The policy module owns
 * the vocabulary because the browser needs the labels and the per-side fence
 * without pulling drizzle into the bundle, and a second hand-written copy is
 * how the role enum silently broke every admin role assignment (CLAUDE.md
 * gotcha 8).
 *
 * The side is deliberately not `actor_role`: a carrier and its employed driver
 * are one commercial side, and `shipment_events.actor_role` cannot stand in for
 * it anyway — that row is a separate insert that can fail after the shipment
 * has already flipped, and `recordEvent` collapses staff onto `admin`.
 */
export const shipmentCancellationSideEnum = pgEnum(
  "shipment_cancellation_side",
  CANCELLATION_SIDES
);

export const shipmentCancellationCategoryEnum = pgEnum(
  "shipment_cancellation_category",
  CANCELLATION_CATEGORIES
);

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

    // Evidence of what happened at either end lives in `shipment_photos`, not
    // here: there is more than one photo, and each carries a location.
    pickedUpAt: timestamp("picked_up_at"),
    deliveredAt: timestamp("delivered_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancellationReason: text("cancellation_reason"),

    // Which side ended it, and why. The free-text reason above is what a human
    // wrote; these two are what a rule and a report can read.
    cancelledBySide: shipmentCancellationSideEnum("cancelled_by_side"),
    cancellationCategory: shipmentCancellationCategoryEnum(
      "cancellation_category"
    ),
    // Two identity columns, as on `shipment_confirmations` and for the same
    // reason: an Expedion quote owner has no `user` row, so a foreign key alone
    // cannot record who asked. Exactly one of the pair is set.
    cancelledByUserId: text("cancelled_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    cancelledByRef: text("cancelled_by_ref"),

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
    index("shipment_cancelled_side_idx").on(table.cancelledBySide),
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
// Shipment Confirmations
// ========================================
//
// The transporter moves the status; the client attests that the milestone
// really happened. Those are two different facts about one moment, which is
// why this is not a column on `shipments` and not a `shipment_events` row.
//
// A confirmation grants nothing. It cannot advance a status, capture a
// payment or close a listing - see transport_status_confirmation_spec.md §1.
// That is the whole reason the one-tap link in §6 can be mailed to a client
// who has no account.

export const shipmentConfirmationChannelEnum = pgEnum(
  "shipment_confirmation_channel",
  [
    /** An authenticated Expedion caller confirmed in the Flutter app. */
    "expedion_app",
    /** A signed one-tap link from the SMS or the email was used. */
    "link",
    /**
     * A signed-in party confirmed on Expeditoo's own delivery screen.
     *
     * Neither of the two above could carry it: `expedion_app` names the
     * sibling product's Flutter client, and `link` claims an unauthenticated
     * 30-day token was used - which is precisely the distinction `channel`
     * exists to record. Appended rather than inserted in place, which is safe
     * here because nothing orders by this enum.
     */
    "app",
  ]
);

/**
 * *Who* answered, as distinct from `channel`, which is *how* they answered.
 *
 * An operator may confirm on a client's behalf. Without this the two are
 * indistinguishable, and every surface would read "le client a confirmé" for
 * an answer the client never gave - which is the one thing a confirmation
 * exists to rule out.
 */
export const shipmentConfirmationActorEnum = pgEnum(
  "shipment_confirmation_actor",
  ["client", "operator"]
);

export const shipmentConfirmations = pgTable(
  "shipment_confirmations",
  {
    id: text("id").primaryKey(),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),

    /** `PICKED_UP` or `DELIVERED` - the two moments goods change hands. */
    milestone: shipmentStatusEnum("milestone").notNull(),
    channel: shipmentConfirmationChannelEnum("channel").notNull(),
    confirmedByRole: shipmentConfirmationActorEnum("confirmed_by_role")
      .default("client")
      .notNull(),

    /**
     * Both nullable, and both needed: most Expedion clients have no `user`
     * row at all - they are quote owners keyed by `expedion_quotes.
     * firebase_uid` - so a foreign key alone could not record who answered.
     */
    confirmedByUserId: text("confirmed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    confirmedByRef: text("confirmed_by_ref"),

    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    /**
     * The idempotency key. A double-tapped link, a retried SMS and an app tap
     * after an email tap all land here; the service returns the existing row
     * rather than erroring, because making a client tap twice and then showing
     * them a failure is worse than a duplicate.
     */
    uniqueIndex("shipment_confirmation_unique").on(
      table.shipmentId,
      table.milestone
    ),
    index("shipment_confirmation_shipment_idx").on(table.shipmentId),
  ]
);

// ========================================
// Shipment Photos
// ========================================
//
// The two moments that decide every dispute about a transport job: the goods
// leaving, and the goods arriving. A photo here is evidence, and that is what
// shapes the columns.
//
// The location is not optional and not derived from EXIF. EXIF GPS tags are
// editable with a text editor, so they are stripped on re-encode and ignored;
// what is stored is a live `navigator.geolocation` fix posted with the bytes.
//
// `object_key` and not a URL: these are photos of a client's goods standing at
// a client's address, and there is no public URL for them. Reads go through
// `/api/shipments/:id/photos/:photoId`, which authorises and then redirects to
// a five-minute presigned URL.
//
// There is deliberately no update path anywhere in the stack - see
// shipment_photos_spec.md §6.3. Removal is admin-only and soft, so the row and
// the object outlive the decision to stop showing them.

export const shipmentPhotoStageEnum = pgEnum("shipment_photo_stage", [
  "pickup",
  "delivery",
]);

export const shipmentPhotos = pgTable(
  "shipment_photos",
  {
    id: text("id").primaryKey(),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),

    stage: shipmentPhotoStageEnum("stage").notNull(),

    /** Private R2 key. Never serialised to a client. */
    objectKey: text("object_key").notNull(),
    /** Always `image/webp` - everything is re-encoded on the way in. */
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),

    capturedLat: doublePrecision("captured_lat").notNull(),
    capturedLng: doublePrecision("captured_lng").notNull(),
    /** The fix's own error radius; null when the device reported none. */
    capturedAccuracyM: doublePrecision("captured_accuracy_m"),
    /** Reverse-geocoded label. Best effort: a slow geocoder must not cost a
     *  driver their delivery, so this stays null rather than blocking. */
    capturedAddress: text("captured_address"),

    /**
     * Two clocks, on purpose. `capturedAt` is the device's, and is therefore
     * whatever the device says it is. `recordedAt` is the server's, and it is
     * the one the burn-in stamps and any dispute is argued from. Keeping both
     * costs a column and is the only way to notice a device hours out.
     */
    capturedAt: timestamp("captured_at").notNull(),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),

    uploadedByUserId: text("uploaded_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),

    // Admin-only soft removal. Nothing is erased.
    deletedAt: timestamp("deleted_at"),
    deletedByUserId: text("deleted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    deletionReason: text("deletion_reason"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("shipment_photo_shipment_idx").on(table.shipmentId),
    // The transition gate counts one stage of one shipment, on every move.
    index("shipment_photo_stage_idx").on(table.shipmentId, table.stage),
  ]
);

// ========================================
// Shipment Incidents
// ========================================
//
// "Something has gone wrong" — from either side of a running job.
//
// An incident is a *report*, not a lever. It never moves `shipments.status`,
// never touches `payments`, and gates no transition. It is one party's
// assertion, and letting an assertion gate a capture would hand either side a
// unilateral freeze on the other's money with no adjudication in between. The
// operator queue is the adjudication step.
//
// See docs/specs/incident_reporting_spec.md.

export const shipmentIncidentCategoryEnum = pgEnum(
  "shipment_incident_category",
  [
    /** Goods damaged, wet, broken, short. */
    "damage",
    /** Running late, missed window, stuck in traffic. */
    "delay",
    /** Cannot get in: locked gate, nobody there, wrong address. */
    "access",
    /** The vehicle itself: breakdown, accident, fuel. */
    "vehicle",
    /** What is here is not what the job described. */
    "cargo_mismatch",
    /** Anything with a person's safety in it. */
    "safety",
    "other",
  ]
);

/**
 * Informational, and only that. It sorts the operator queue and gates nothing.
 * There is deliberately no `blocking` value: a value that reads as blocking in
 * a system that blocks nothing is a lie told to whoever reads it next.
 */
export const shipmentIncidentSeverityEnum = pgEnum(
  "shipment_incident_severity",
  ["low", "medium", "high"]
);

export const shipmentIncidentStatusEnum = pgEnum("shipment_incident_status", [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
]);

export const shipmentIncidents = pgTable(
  "shipment_incidents",
  {
    id: text("id").primaryKey(),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),

    category: shipmentIncidentCategoryEnum("category").notNull(),
    severity: shipmentIncidentSeverityEnum("severity")
      .default("medium")
      .notNull(),
    status: shipmentIncidentStatusEnum("status").default("OPEN").notNull(),

    description: text("description").notNull(),

    /**
     * Public URLs from `/api/upload`, not `shipment_photos` object keys.
     *
     * A shipment photo is *evidence*: it demands a live GPS fix and forbids
     * updates. An incident photo is *illustration* — "here is the dented
     * crate". Holding it to the evidence standard would refuse a report from a
     * driver whose GPS is dead inside a warehouse, which is exactly when
     * incidents get filed.
     */
    photoUrls: jsonb("photo_urls").$type<string[]>().default([]).notNull(),

    reportedByUserId: text("reported_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /**
     * Who they were *at the time*, not who they are now. Roles change, and an
     * incident filed by the driver must still read as the driver's after they
     * are moved off the run.
     */
    reportedByRole: actorRoleEnum("reported_by_role").notNull(),

    /** The reporter's support thread, so the conversation has somewhere to go. */
    conversationId: text("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),

    acknowledgedAt: timestamp("acknowledged_at"),
    acknowledgedByUserId: text("acknowledged_by_user_id").references(
      () => user.id,
      { onDelete: "set null" }
    ),

    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Required to resolve. A queue emptied without reasons teaches nothing. */
    resolutionNote: text("resolution_note"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("shipment_incident_shipment_idx").on(table.shipmentId),
    index("shipment_incident_status_idx").on(table.status),
    // The queue reads open incidents newest-first, on every operator page load.
    index("shipment_incident_queue_idx").on(table.status, table.createdAt),
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
  photos: many(shipmentPhotos),
  confirmations: many(shipmentConfirmations),
  incidents: many(shipmentIncidents),
}));

export const shipmentConfirmationsRelations = relations(
  shipmentConfirmations,
  ({ one }) => ({
    shipment: one(shipments, {
      fields: [shipmentConfirmations.shipmentId],
      references: [shipments.id],
    }),
    confirmedBy: one(user, {
      fields: [shipmentConfirmations.confirmedByUserId],
      references: [user.id],
    }),
  })
);

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

export const shipmentPhotosRelations = relations(shipmentPhotos, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentPhotos.shipmentId],
    references: [shipments.id],
  }),
  uploadedBy: one(user, {
    fields: [shipmentPhotos.uploadedByUserId],
    references: [user.id],
  }),
}));

export const shipmentIncidentsRelations = relations(
  shipmentIncidents,
  ({ one }) => ({
    shipment: one(shipments, {
      fields: [shipmentIncidents.shipmentId],
      references: [shipments.id],
    }),
    reportedBy: one(user, {
      fields: [shipmentIncidents.reportedByUserId],
      references: [user.id],
    }),
    conversation: one(conversations, {
      fields: [shipmentIncidents.conversationId],
      references: [conversations.id],
    }),
  })
);

// ========================================
// Type Exports
// ========================================

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;

export type ShipmentEvent = typeof shipmentEvents.$inferSelect;
export type InsertShipmentEvent = typeof shipmentEvents.$inferInsert;

export type ShipmentConfirmation = typeof shipmentConfirmations.$inferSelect;
export type InsertShipmentConfirmation =
  typeof shipmentConfirmations.$inferInsert;

export type ShipmentPhoto = typeof shipmentPhotos.$inferSelect;
export type InsertShipmentPhoto = typeof shipmentPhotos.$inferInsert;

export type ShipmentStatusType = (typeof shipmentStatusEnum.enumValues)[number];
export type ShipmentPhotoStage =
  (typeof shipmentPhotoStageEnum.enumValues)[number];
export type ShipmentConfirmationChannel =
  (typeof shipmentConfirmationChannelEnum.enumValues)[number];
export type ShipmentConfirmationActor =
  (typeof shipmentConfirmationActorEnum.enumValues)[number];
export type ActorRoleType = (typeof actorRoleEnum.enumValues)[number];

export type ShipmentCancellationSide =
  (typeof shipmentCancellationSideEnum.enumValues)[number];
export type ShipmentCancellationCategory =
  (typeof shipmentCancellationCategoryEnum.enumValues)[number];

export type ShipmentIncident = typeof shipmentIncidents.$inferSelect;
export type InsertShipmentIncident = typeof shipmentIncidents.$inferInsert;

export type ShipmentIncidentCategory =
  (typeof shipmentIncidentCategoryEnum.enumValues)[number];
export type ShipmentIncidentSeverity =
  (typeof shipmentIncidentSeverityEnum.enumValues)[number];
export type ShipmentIncidentStatus =
  (typeof shipmentIncidentStatusEnum.enumValues)[number];
