import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  index,
  doublePrecision,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { reviews } from "./reviews";

// ========================================
// User Roles Enum
// ========================================

export const userRoleEnum = pgEnum("user_role", [
  "buyer",
  "seller",
  "auctioneer",
  "transporter",
  "operator",
  "admin",
]);

export type UserRoleEnum =
  | "buyer"
  | "seller"
  | "auctioneer"
  | "transporter"
  | "operator"
  | "admin";

// ========================================
// Application Status Enum
// ========================================

export const applicationStatusEnum = pgEnum("application_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

// ========================================
// Stripe Account Status Enum
// ========================================

export const stripeAccountStatusEnum = pgEnum("stripe_account_status", [
  "pending",
  "active",
  "restricted",
]);

// ========================================
// User Preferences Interface
// ========================================

export interface UserPreferences {
  notifications: {
    email: {
      auctionResults: boolean;
      outbid: boolean;
      orderConfirmation: boolean;
      paymentConfirmation: boolean;
      shipmentUpdates: boolean;
      invoiceReady: boolean;
      marketing: boolean;
      security: boolean;
    };
    inApp: {
      auctionResults: boolean;
      outbid: boolean;
      orderConfirmation: boolean;
      paymentConfirmation: boolean;
      shipmentUpdates: boolean;
      invoiceReady: boolean;
      messages: boolean;
    };
  };
}

export const defaultPreferences: UserPreferences = {
  notifications: {
    email: {
      auctionResults: true,
      outbid: true,
      orderConfirmation: true,
      paymentConfirmation: true,
      shipmentUpdates: true,
      invoiceReady: true,
      marketing: false,
      security: true,
    },
    inApp: {
      auctionResults: true,
      outbid: true,
      orderConfirmation: true,
      paymentConfirmation: true,
      shipmentUpdates: true,
      invoiceReady: true,
      messages: true,
    },
  },
};

// ========================================
// Users Table (Better Auth Standard)
// ========================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  banned: boolean("banned").default(false).notNull(),
  rating: doublePrecision("rating").default(0).notNull(),
  reputationScore: integer("reputation_score").default(0).notNull(),

  // Stripe Connect
  stripeAccountId: text("stripe_account_id"),
  stripeAccountStatus: stripeAccountStatusEnum("stripe_account_status").default(
    "pending"
  ),
  stripeCustomerId: text("stripe_customer_id"),

  // JSONB Preferences Column
  preferences: jsonb("preferences")
    .$type<UserPreferences>()
    .default(defaultPreferences)
    .notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
},
  (table) => {
    return [
      index("user_rating_idx").on(table.rating),
      index("user_reputation_idx").on(table.reputationScore),
    ];
  });

// ========================================
// Sessions Table (Better Auth Standard)
// ========================================

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

// ========================================
// Accounts Table (Better Auth Standard)
// ========================================

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

// ========================================
// Verification Table (Better Auth Standard)
// ========================================

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

// ========================================
// User Roles Table (Custom - Many-to-Many)
// ========================================

export const userRoles = pgTable("user_roles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: userRoleEnum("role").notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  assignedBy: text("assigned_by").references(() => user.id, {
    onDelete: "set null",
  }),
});

// ========================================
// Driver Applications Table
// ========================================

export const driverApplications = pgTable("driver_applications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: applicationStatusEnum("status").default("PENDING").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  vehiclePlate: text("vehicle_plate").notNull(),
  licenseNumber: text("license_number").notNull(),
  siret: text("siret").notNull(),
  companyName: text("company_name"),
  proposalRate: text("proposal_rate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ========================================
// Relations
// ========================================

export const userRelations = relations(user, ({ many }) => ({
  roles: many(userRoles, {
    relationName: "userToRoles",
  }),
  sessions: many(session),
  accounts: many(account),
  driverApplications: many(driverApplications),
  // Reviews relations (bidirectional with reviews schema)
  reviewsReceived: many(reviews, {
    relationName: "targetUserToReviews",
  }),
  reviewsWritten: many(reviews, {
    relationName: "authorToReviews",
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(user, {
    fields: [userRoles.userId],
    references: [user.id],
    relationName: "userToRoles",
  }),
  assigner: one(user, {
    fields: [userRoles.assignedBy],
    references: [user.id],
    relationName: "assignerToRoles",
  }),
}));

export const driverApplicationsRelations = relations(
  driverApplications,
  ({ one }) => ({
    user: one(user, {
      fields: [driverApplications.userId],
      references: [user.id],
    }),
  })
);

// ========================================
// Type Exports
// ========================================

export type User = typeof user.$inferSelect;
export type InsertUser = typeof user.$inferInsert;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;

export type Session = typeof session.$inferSelect;
export type InsertSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type InsertAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type InsertVerification = typeof verification.$inferInsert;

export type DriverApplication = typeof driverApplications.$inferSelect;
export type InsertDriverApplication = typeof driverApplications.$inferInsert;
