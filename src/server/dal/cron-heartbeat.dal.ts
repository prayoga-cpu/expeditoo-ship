import { db } from "@/db";
import { cronHeartbeat } from "@/db/schema/cron-heartbeat";

export const cronHeartbeatDal = {
  async list() {
    return db.select().from(cronHeartbeat);
  },

  async record(job: string, run: { ok: boolean; error?: string; at: Date }) {
    const values = {
      lastRunAt: run.at,
      lastOk: run.ok,
      lastError: run.ok ? null : (run.error ?? "unknown error").slice(0, 500),
      ...(run.ok ? { lastOkAt: run.at } : {}),
    };
    await db
      .insert(cronHeartbeat)
      .values({ job, ...values })
      .onConflictDoUpdate({ target: cronHeartbeat.job, set: values });
  },
};
