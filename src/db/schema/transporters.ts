import {
    pgTable,
    text,
    timestamp,
    integer,
    doublePrecision,
    boolean,
    jsonb,
    index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";

// ========================================
// Transporter Profile Table
// ========================================

export interface TransporterServiceZone {
    city: string;
    postalCode?: string;
    radius?: number; // km
}

export interface TransporterVehicle {
    type: string; // car, van, truck, motorcycle, bicycle
    make?: string;
    model?: string;
    year?: number;
    plateNumber: string;
    capacity: {
        maxWeight: number; // kg
        maxLength?: number; // cm
        maxWidth?: number; // cm
        maxHeight?: number; // cm
    };
    features?: string[]; // e.g., "refrigerated", "fragile-friendly"
}

export const transporterProfiles = pgTable(
    "transporter_profiles",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .unique()
            .references(() => user.id, { onDelete: "cascade" }),

        // Vehicle Information (JSONB for flexibility)
        vehicle: jsonb("vehicle").$type<TransporterVehicle>().notNull(),

        // Service Zones (array of zones)
        serviceZones: jsonb("service_zones").$type<TransporterServiceZone[]>().default([]).notNull(),

        // Availability
        isAvailable: boolean("is_available").default(true).notNull(),
        maxShipmentsPerDay: integer("max_shipments_per_day").default(5),

        // Stats
        totalDeliveries: integer("total_deliveries").default(0).notNull(),
        completedDeliveries: integer("completed_deliveries").default(0).notNull(),
        cancelledDeliveries: integer("cancelled_deliveries").default(0).notNull(),

        // Ratings (denormalized for performance)
        averageRating: doublePrecision("average_rating").default(0).notNull(),
        totalRatings: integer("total_ratings").default(0).notNull(),

        // Total Earnings (denormalized)
        totalEarnings: integer("total_earnings").default(0).notNull(), // in cents

        // Bio/Description
        bio: text("bio"),

        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("transporter_user_idx").on(table.userId),
        index("transporter_available_idx").on(table.isAvailable),
        index("transporter_rating_idx").on(table.averageRating),
    ]
);

// ========================================
// Relations
// ========================================

export const transporterProfilesRelations = relations(transporterProfiles, ({ one }) => ({
    user: one(user, {
        fields: [transporterProfiles.userId],
        references: [user.id],
    }),
}));

// ========================================
// Type Exports
// ========================================

export type TransporterProfile = typeof transporterProfiles.$inferSelect;
export type InsertTransporterProfile = typeof transporterProfiles.$inferInsert;
