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
// Seven roles per docs/specs/roles_spec.md. The carrier company is separate
// from the drivers it employs, and back-office duties are split out of admin
// so support and finance staff never hold full access.

export const userRoleEnum = pgEnum("user_role", [
  "shipper",
  "carrier",
  "driver",
  "operator",
  "support",
  "finance",
  "admin",
]);

export type UserRoleEnum =
  | "shipper"
  | "carrier"
  | "driver"
  | "operator"
  | "support"
  | "finance"
  | "admin";

// ========================================
// Stripe Account Status Enum
// ========================================

export const stripeAccountStatusEnum = pgEnum("stripe_account_status", [
  "pending",
  "active",
  "restricted",
]);

// ========================================
// Signup Origin Enum
// ========================================
// Which of the two products the account was created in. EXPEDITOO and Expedion
// share this Better Auth instance and this table, and nothing recorded which
// app a person actually signed up in -- the admin user list could not tell a
// driver from an Expedion client. Owning a quote is not an answer: 4,588 of the
// 4,593 imported quotes carry no user at all.

export const userOriginEnum = pgEnum("user_origin", ["expeditoo", "expedion"]);

// ========================================
// User Preferences Interface
// ========================================

export interface UserPreferences {
  notifications: {
    email: {
      offerReceived: boolean;
      offerAccepted: boolean;
      offerRejected: boolean;
      paymentConfirmation: boolean;
      shipmentUpdates: boolean;
      invoiceReady: boolean;
      marketing: boolean;
      security: boolean;
    };
    inApp: {
      offerReceived: boolean;
      offerAccepted: boolean;
      offerRejected: boolean;
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
      offerReceived: true,
      offerAccepted: true,
      offerRejected: true,
      paymentConfirmation: true,
      shipmentUpdates: true,
      invoiceReady: true,
      marketing: false,
      security: true,
    },
    inApp: {
      offerReceived: true,
      offerAccepted: true,
      offerRejected: true,
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

export const user = pgTable(
  "user",
  {
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
    stripeAccountStatus: stripeAccountStatusEnum(
      "stripe_account_status"
    ).default("pending"),
    stripeCustomerId: text("stripe_customer_id"),

    // JSONB Preferences Column
    preferences: jsonb("preferences")
      .$type<UserPreferences>()
      .default(defaultPreferences)
      .notNull(),

    // Stamped by the session-create hook in src/lib/auth.ts on every real
    // sign-in. An impersonation session deliberately leaves it alone: an admin
    // opening the account is not this person getting in.
    lastLoginAt: timestamp("last_login_at"),

    // Which app this account was created in, from the request's Origin at
    // signup (src/lib/app-origins.ts). Defaults to `expeditoo` because that is
    // what an absent Origin means for every server-side and same-origin call.
    origin: userOriginEnum("origin").default("expeditoo").notNull(),

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
  }
);

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
    // Set only on a session an admin opened as somebody else. Declared to
    // Better Auth by the impersonation plugin (src/lib/auth-impersonation.ts),
    // which is what lets the adapter read and write it.
    impersonatedBy: text("impersonated_by").references(() => user.id, {
      onDelete: "cascade",
    }),
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
// A user may hold several roles; a carrier who also ships is normal.

export const userRoles = pgTable(
  "user_roles",
  {
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
  },
  (table) => [index("user_roles_user_idx").on(table.userId)]
);

// ========================================
// Impersonation Sessions (Audit)
// ========================================
// One row per "log in as this user" an admin performs. Both emails are stored
// alongside the ids because the record has to outlive the accounts it names --
// deleting a user is one of the actions offered on the same admin screen.

export const impersonationSessions = pgTable(
  "impersonation_sessions",
  {
    id: text("id").primaryKey(),
    adminId: text("admin_id").references(() => user.id, {
      onDelete: "set null",
    }),
    adminEmail: text("admin_email").notNull(),
    targetUserId: text("target_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    targetEmail: text("target_email").notNull(),
    sessionToken: text("session_token").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("impersonation_admin_idx").on(table.adminId),
    index("impersonation_target_idx").on(table.targetUserId),
    index("impersonation_token_idx").on(table.sessionToken),
  ]
);

// ========================================
// Relations
// ========================================

export const userRelations = relations(user, ({ many }) => ({
  roles: many(userRoles, {
    relationName: "userToRoles",
  }),
  sessions: many(session),
  accounts: many(account),
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

export type ImpersonationSession = typeof impersonationSessions.$inferSelect;
export type InsertImpersonationSession =
  typeof impersonationSessions.$inferInsert;
