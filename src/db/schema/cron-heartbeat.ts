import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ========================================
// Cron heartbeat — the last run of each scheduled job
// ========================================
//
// One row per job, stamped by its `/api/cron/*` route after an authorised run,
// so Admin → Paramètres can say whether the scheduled jobs are running at all
// (client_feedback_2026_10_21_spec.md §X1). They had not run once in
// production: the GitHub workflow that calls them was missing its URL and
// secret, and nothing inside the app could tell.
//
// Only an authorised run writes: a request with a wrong secret is refused
// before it reaches the table, so the table cannot be written from outside.

export const cronHeartbeat = pgTable("cron_heartbeat", {
  /** The route's last path segment, « expire-listings ». */
  job: text("job").primaryKey(),
  lastRunAt: timestamp("last_run_at").notNull(),
  /** Whether that run finished without throwing. */
  lastOk: boolean("last_ok").notNull(),
  /** The error message of a failed run; null after a good one. */
  lastError: text("last_error"),
  /** The last run that finished without throwing, kept across failures. */
  lastOkAt: timestamp("last_ok_at"),
});

export type CronHeartbeatRow = typeof cronHeartbeat.$inferSelect;
