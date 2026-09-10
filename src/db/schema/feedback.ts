import { pgTable, text, timestamp, pgEnum, index, jsonb } from "drizzle-orm/pg-core";
import { user } from "./users";

// ========================================
// Feedback Enums
// ========================================
/**
 * All values are declared here in the FIRST migration, in triage order, and
 * that ordering is load-bearing rather than cosmetic.
 *
 * Postgres orders an enum by declaration order, so `ORDER BY status, priority`
 * *is* the queue order with no `CASE` expression. Two neighbours show both ways
 * of getting this wrong: Epidom appended `ARCHIVED` and `NEEDS_REVIEW` with
 * later `ALTER TYPE ... ADD VALUE`, so its physical order diverged from its
 * display order permanently; and `shipment_incident_severity` here is declared
 * low-to-high, which is why `listQueue` needs an explicit `CASE` to stop the
 * calmest incidents sorting to the top.
 */
export const feedbackTypeEnum = pgEnum("feedback_type", [
  "bug",
  "idea",
  "general",
]);

export const feedbackPriorityEnum = pgEnum("feedback_priority", [
  "urgent",
  "high",
  "medium",
  "low",
]);

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "OPEN",
  "IN_PROGRESS",
  "NEEDS_REVIEW",
  "RESOLVED",
  "ARCHIVED",
]);

// ========================================
// Feedback Tickets Table
// ========================================
/**
 * Something a user told us, and what we did about it.
 *
 * Named `feedback_tickets` rather than `feedback` because every table here is a
 * plural count noun and "feedback" is a mass noun that reads like a column;
 * `user` is the only singular and that one is Better Auth's.
 *
 * **The ticket outlives the account.** `user_id` nulls on delete, which is why
 * `user_name`, `user_email` and `user_role` are frozen snapshots taken at
 * submit time — a bug report has to stay readable after the reporter leaves,
 * and the console still needs a person's name against it.
 *
 * See docs/specs/feedback_spec.md §1.
 */
export const feedbackTickets = pgTable(
  "feedback_tickets",
  {
    id: text("id").primaryKey(),

    // Nullable on purpose, paired with the snapshot columns below.
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    userName: text("user_name").notNull(),
    userEmail: text("user_email").notNull(),
    // Plain text, not a `user_role` enum column: `primaryRole()` can return
    // "user" (NO_ROLE_LABEL), which is deliberately not a member of
    // `userRoleEnum`, and minting a type to hold seven roles plus one non-role
    // would be a migration for a display string.
    userRole: text("user_role").notNull(),

    type: feedbackTypeEnum("type").notNull(),

    // `surface` is a key from the closed FEEDBACK_SURFACES list in the DTO, not
    // a pgEnum: adding a page must not need a migration, and which pages exist
    // is UI knowledge rather than database vocabulary. It is what the console
    // groups by; `pathname` is what reproduces the bug, because our URLs carry
    // the ids an engineer needs (/listing/[id], /deliveries/[id]).
    surface: text("surface").notNull(),
    pathname: text("pathname"),

    description: text("description").notNull(),

    // An array, like `shipment_incidents.photo_urls` on the same upload path —
    // a bug is often two screens. Capped in the DTO, not here.
    screenshotUrls: jsonb("screenshot_urls")
      .$type<string[]>()
      .default([])
      .notNull(),

    // Both server-stamped. This repo bumps APP_VERSION every session, so "which
    // build" is the first question about any bug; FR/EN parity has broken three
    // times, so "which locale" is the second.
    appVersion: text("app_version").notNull(),
    locale: text("locale").notNull(),

    status: feedbackStatusEnum("status").default("OPEN").notNull(),
    priority: feedbackPriorityEnum("priority").default("medium").notNull(),

    // Admin-private. Its privacy is enforced by `toFeedbackView` omitting it,
    // never by the UI choosing not to render it.
    devNote: text("dev_note"),

    // Two columns instead of an audit subsystem: Epidom needed a separate audit
    // log precisely because closing a ticket left no trace of when or by whom,
    // and there is no audit table in this schema.
    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Drizzle does not write this for you the way Prisma's @updatedAt does.
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("feedback_ticket_status_idx").on(table.status),
    // The console's default read, on every page load.
    index("feedback_ticket_queue_idx").on(table.status, table.createdAt),
    // "My feedback". Epidom filters on userId with no index on it.
    index("feedback_ticket_user_idx").on(table.userId),
  ]
);

export type FeedbackTicket = typeof feedbackTickets.$inferSelect;
export type InsertFeedbackTicket = typeof feedbackTickets.$inferInsert;

export type FeedbackTypeValue = (typeof feedbackTypeEnum.enumValues)[number];
export type FeedbackPriorityValue =
  (typeof feedbackPriorityEnum.enumValues)[number];
export type FeedbackStatusValue = (typeof feedbackStatusEnum.enumValues)[number];
