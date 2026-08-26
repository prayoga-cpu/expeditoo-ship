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
import { carriers, vehicles } from "./carriers";

// ========================================
// Enums
// ========================================
// A trip is a route the carrier already drives, declared so the job board can
// be filtered down to it (carrier_trips_spec.md §1). It is private to the
// carrier: not an offer, not a commitment, and no operator sees it.

export const carrierRouteKindEnum = pgEnum("carrier_route_kind", [
  "recurring",
  "occasional",
]);

// ========================================
// Carrier Routes Table
// ========================================

export const carrierRoutes = pgTable(
  "carrier_routes",
  {
    id: text("id").primaryKey(),
    carrierId: text("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),

    label: text("label"),
    kind: carrierRouteKindEnum("kind").notNull(),

    // ---- Where it starts ----
    originAddress: text("origin_address").notNull(),
    originCity: text("origin_city").notNull(),
    originPostalCode: text("origin_postal_code").notNull(),
    // Not nullable: geography is the whole point, and a trip without
    // coordinates could never be matched against the board.
    originLat: doublePrecision("origin_lat").notNull(),
    originLng: doublePrecision("origin_lng").notNull(),

    // ---- Where it ends ----
    destinationAddress: text("destination_address").notNull(),
    destinationCity: text("destination_city").notNull(),
    destinationPostalCode: text("destination_postal_code").notNull(),
    destinationLat: doublePrecision("destination_lat").notNull(),
    destinationLng: doublePrecision("destination_lng").notNull(),

    // How far off the origin the carrier will still take a job.
    radiusKm: integer("radius_km").default(50).notNull(),

    // ---- When: recurring ----
    // ISO weekdays, 1 (Monday) to 7 (Sunday). Empty for an occasional trip.
    // jsonb rather than a Postgres array to match `vehicles.features`; it is
    // never queried element-wise server-side.
    daysOfWeek: jsonb("days_of_week").$type<number[]>().default([]).notNull(),
    validFrom: timestamp("valid_from"),
    validUntil: timestamp("valid_until"),

    // ---- What runs it ----
    vehicleId: text("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    capacityKg: doublePrecision("capacity_kg"),

    // Stored now, consumed by a later cron (carrier_trips_spec.md §9).
    notifyOnMatch: boolean("notify_on_match").default(true).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("carrier_route_carrier_idx").on(table.carrierId),
    index("carrier_route_active_idx").on(table.isActive),
  ]
);

// ========================================
// Carrier Route Dates Table
// ========================================
// The "on specific dates" half of the client's ask. A child table rather than a
// JSON column because dates are matched by range.

export const carrierRouteDates = pgTable(
  "carrier_route_dates",
  {
    id: text("id").primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => carrierRoutes.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(),
  },
  (table) => [
    index("carrier_route_date_route_idx").on(table.routeId),
    unique("carrier_route_date_unique").on(table.routeId, table.date),
  ]
);

// ========================================
// Relations
// ========================================

export const carrierRoutesRelations = relations(
  carrierRoutes,
  ({ one, many }) => ({
    carrier: one(carriers, {
      fields: [carrierRoutes.carrierId],
      references: [carriers.id],
    }),
    vehicle: one(vehicles, {
      fields: [carrierRoutes.vehicleId],
      references: [vehicles.id],
    }),
    dates: many(carrierRouteDates),
  })
);

export const carrierRouteDatesRelations = relations(
  carrierRouteDates,
  ({ one }) => ({
    route: one(carrierRoutes, {
      fields: [carrierRouteDates.routeId],
      references: [carrierRoutes.id],
    }),
  })
);

// ========================================
// Type Exports
// ========================================

export type CarrierRoute = typeof carrierRoutes.$inferSelect;
export type InsertCarrierRoute = typeof carrierRoutes.$inferInsert;
export type CarrierRouteDate = typeof carrierRouteDates.$inferSelect;
export type InsertCarrierRouteDate = typeof carrierRouteDates.$inferInsert;
export type CarrierRouteKind = (typeof carrierRouteKindEnum.enumValues)[number];
