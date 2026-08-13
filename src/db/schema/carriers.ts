import {
  pgTable,
  text,
  timestamp,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";

// ========================================
// Enums
// ========================================
// See docs/specs/carrier_kyc_spec.md §2 for the state machine.

export const carrierStatusEnum = pgEnum("carrier_status", [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "suspended",
]);

export const carrierDocumentKindEnum = pgEnum("carrier_document_kind", [
  "cni_recto",
  "cni_verso",
  "driving_licence",
  "kbis",
  "insurance_certificate",
  "transport_licence",
  "rib",
]);

export const carrierDocumentStatusEnum = pgEnum("carrier_document_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "motorcycle",
  "car",
  "van",
  "truck_3_5t",
  "truck_7_5t",
  "truck_19t",
  "semi_trailer",
  "flatbed",
  "refrigerated",
]);

// Vehicle types at or above 7.5t require a transport licence under French
// regulation (carrier_kyc_spec.md §3).
export const HEAVY_VEHICLE_TYPES = [
  "truck_7_5t",
  "truck_19t",
  "semi_trailer",
  "flatbed",
] as const;

// ========================================
// Carriers Table
// ========================================

export const carriers = pgTable(
  "carriers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Company identity
    companyName: text("company_name").notNull(),
    siret: text("siret").notNull().unique(),
    vatNumber: text("vat_number"),
    legalForm: text("legal_form"),
    contactPhone: text("contact_phone").notNull(),
    addressLine: text("address_line").notNull(),
    city: text("city").notNull(),
    postalCode: text("postal_code").notNull(),

    status: carrierStatusEnum("status").default("draft").notNull(),

    // Banking. The full IBAN/BIC is never persisted here - it goes straight to
    // Stripe, and only the last 4 are kept for display (carrier_kyc_spec.md §4.3).
    ibanLast4: text("iban_last4"),
    bicLast4: text("bic_last4"),
    stripeAccountId: text("stripe_account_id"),

    // Review trail
    approvedAt: timestamp("approved_at"),
    approvedBy: text("approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),
    suspensionReason: text("suspension_reason"),

    // Denormalised stats
    averageRating: doublePrecision("average_rating").default(0).notNull(),
    totalRatings: integer("total_ratings").default(0).notNull(),
    completedJobs: integer("completed_jobs").default(0).notNull(),

    bio: text("bio"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("carrier_user_idx").on(table.userId),
    index("carrier_status_idx").on(table.status),
    index("carrier_rating_idx").on(table.averageRating),
  ]
);

// ========================================
// Carrier Documents Table
// ========================================
// Identity documents. Stored under a private R2 prefix and only ever served
// through a short-lived presigned URL (carrier_kyc_spec.md §4).

export const carrierDocuments = pgTable(
  "carrier_documents",
  {
    id: text("id").primaryKey(),
    carrierId: text("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    kind: carrierDocumentKindEnum("kind").notNull(),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    expiresAt: timestamp("expires_at"),
    status: carrierDocumentStatusEnum("status").default("pending").notNull(),
    rejectionReason: text("rejection_reason"),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (table) => [
    index("carrier_document_carrier_idx").on(table.carrierId),
    index("carrier_document_expiry_idx").on(table.expiresAt),
    unique("carrier_document_kind_unique").on(table.carrierId, table.kind),
  ]
);

// ========================================
// Vehicles Table
// ========================================
// A carrier runs a fleet, and an offer names the specific vehicle that will do
// the job - so vehicles are rows, not a JSONB blob on the carrier.

export const vehicles = pgTable(
  "vehicles",
  {
    id: text("id").primaryKey(),
    carrierId: text("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),

    type: vehicleTypeEnum("type").notNull(),
    make: text("make"),
    model: text("model"),
    year: integer("year"),
    plateNumber: text("plate_number").notNull(),

    // Capacity
    maxWeightKg: doublePrecision("max_weight_kg").notNull(),
    maxLengthCm: doublePrecision("max_length_cm"),
    maxWidthCm: doublePrecision("max_width_cm"),
    maxHeightCm: doublePrecision("max_height_cm"),

    features: jsonb("features").$type<string[]>().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("vehicle_carrier_idx").on(table.carrierId),
    index("vehicle_active_idx").on(table.isActive),
    unique("vehicle_plate_per_carrier").on(table.carrierId, table.plateNumber),
  ]
);

// ========================================
// Carrier Drivers Table
// ========================================
// Employees of a carrier who execute shipments but never bid or see money
// (roles_spec.md §1).

export const carrierDrivers = pgTable(
  "carrier_drivers",
  {
    id: text("id").primaryKey(),
    carrierId: text("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").default(true).notNull(),
    invitedAt: timestamp("invited_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
  },
  (table) => [
    index("carrier_driver_carrier_idx").on(table.carrierId),
    index("carrier_driver_user_idx").on(table.userId),
    unique("carrier_driver_unique").on(table.carrierId, table.userId),
  ]
);

// ========================================
// Relations
// ========================================

export const carriersRelations = relations(carriers, ({ one, many }) => ({
  user: one(user, {
    fields: [carriers.userId],
    references: [user.id],
  }),
  approver: one(user, {
    fields: [carriers.approvedBy],
    references: [user.id],
    relationName: "approverToCarriers",
  }),
  documents: many(carrierDocuments),
  vehicles: many(vehicles),
  drivers: many(carrierDrivers),
}));

export const carrierDocumentsRelations = relations(
  carrierDocuments,
  ({ one }) => ({
    carrier: one(carriers, {
      fields: [carrierDocuments.carrierId],
      references: [carriers.id],
    }),
  })
);

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  carrier: one(carriers, {
    fields: [vehicles.carrierId],
    references: [carriers.id],
  }),
}));

export const carrierDriversRelations = relations(carrierDrivers, ({ one }) => ({
  carrier: one(carriers, {
    fields: [carrierDrivers.carrierId],
    references: [carriers.id],
  }),
  user: one(user, {
    fields: [carrierDrivers.userId],
    references: [user.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Carrier = typeof carriers.$inferSelect;
export type InsertCarrier = typeof carriers.$inferInsert;

export type CarrierDocument = typeof carrierDocuments.$inferSelect;
export type InsertCarrierDocument = typeof carrierDocuments.$inferInsert;

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

export type CarrierDriver = typeof carrierDrivers.$inferSelect;
export type InsertCarrierDriver = typeof carrierDrivers.$inferInsert;

export type CarrierStatus = (typeof carrierStatusEnum.enumValues)[number];
export type CarrierDocumentKind =
  (typeof carrierDocumentKindEnum.enumValues)[number];
export type VehicleType = (typeof vehicleTypeEnum.enumValues)[number];
