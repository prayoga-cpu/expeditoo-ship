import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ========================================
// Stripe webhook heartbeat — the last event this app verified
// ========================================
//
// One row (`id = "default"`). The webhook route stamps it after a signature
// verifies, so the admin can see that Stripe reaches this deployment without
// opening the Stripe dashboard (launch_readiness_spec.md §B). Its own table
// rather than columns on `platform_settings`, whose `updated_at` is shown as
// « last changed » for the fee and would otherwise move on every event.

export const stripeWebhookHeartbeat = pgTable("stripe_webhook_heartbeat", {
  id: text("id").primaryKey(),
  lastEventAt: timestamp("last_event_at").notNull(),
  lastEventType: text("last_event_type").notNull(),
  /** Whether the event came from live mode — a test event says false. */
  lastEventLivemode: boolean("last_event_livemode").notNull(),
});

export type StripeWebhookHeartbeatRow =
  typeof stripeWebhookHeartbeat.$inferSelect;
