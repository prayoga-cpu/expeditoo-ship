import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stripeWebhookHeartbeat } from "@/db/schema/stripe-webhook-heartbeat";

const HEARTBEAT_ID = "default";

export const stripeWebhookHeartbeatDal = {
  async get() {
    return db.query.stripeWebhookHeartbeat.findFirst({
      where: eq(stripeWebhookHeartbeat.id, HEARTBEAT_ID),
    });
  },

  async record(event: { type: string; livemode: boolean; at: Date }) {
    const values = {
      lastEventAt: event.at,
      lastEventType: event.type,
      lastEventLivemode: event.livemode,
    };
    await db
      .insert(stripeWebhookHeartbeat)
      .values({ id: HEARTBEAT_ID, ...values })
      .onConflictDoUpdate({ target: stripeWebhookHeartbeat.id, set: values });
  },
};
