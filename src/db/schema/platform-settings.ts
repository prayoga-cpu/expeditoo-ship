import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { user } from "./users";

// ========================================
// Platform settings — a single admin-configurable row
// ========================================
//
// One typed column beats a key-value table here: the read side
// (`chargeForShipment`) is a hot, money-moving path, and a malformed or
// missing text value there would corrupt a real capture. A typed column with
// a DB default of 0 cannot be either. Revisit only once there are enough
// heterogeneous settings that a dedicated migration per one stops making
// sense — not the case with exactly one setting.
//
// Singleton enforced by a fixed well-known primary key (`id = "default"`),
// upserted rather than inserted. Bounds (0-10000 basis points) are enforced
// at the service boundary via zod, not a DB CHECK — this schema has no
// CHECK-constraint precedent anywhere else to follow instead.

export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey(),
  // 0-10000 = 0%-100%, added on top of what the client is charged at award
  // time — not the same thing as `payments.commissionCents`, which is a cut
  // taken from the *carrier's* side instead.
  feeBasisPoints: integer("fee_basis_points").default(0).notNull(),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type PlatformSettingsRow = typeof platformSettings.$inferSelect;
export type InsertPlatformSettings = typeof platformSettings.$inferInsert;
