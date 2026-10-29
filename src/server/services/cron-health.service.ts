import { cronHeartbeatDal } from "@/server/dal/cron-heartbeat.dal";
import { hasRole as userHasRole } from "@/server/services/user.service";

/**
 * Whether the scheduled jobs run (client_feedback_2026_10_21_spec.md §X1).
 *
 * The jobs are called from `.github/workflows/scheduled-jobs.yml`, not from
 * Vercel, and that workflow had failed every run since it was written — the
 * repository was missing `APP_URL` and `CRON_SECRET` — so no listing ever
 * expired and no paid quote was ever published automatically. Nothing in the
 * app could see it. Each route now stamps a heartbeat, and the admin reads it
 * here.
 */

export class CronHealthError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code);
    this.name = "CronHealthError";
  }
}

/** Every job the workflow calls, with the schedule it is meant to keep. */
export const CRON_JOBS = [
  { job: "publish-scheduled-listings", everyMinutes: 5 },
  { job: "expedion-escalate", everyMinutes: 10 },
  { job: "expire-listings", everyMinutes: 15 },
  // client_feedback_2026_10_29_spec.md §N3.
  { job: "release-payouts", everyMinutes: 60 },
  { job: "carrier-documents", everyMinutes: 24 * 60 },
  { job: "cleanup-images", everyMinutes: 7 * 24 * 60 },
] as const;

export type CronJob = (typeof CRON_JOBS)[number]["job"];

export type CronState = "ok" | "late" | "failing" | "never";

export interface CronJobStatus {
  job: CronJob;
  everyMinutes: number;
  state: CronState;
  lastRunAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
}

/**
 * GitHub runs scheduled workflows late and sometimes skips one, so « late »
 * means three missed slots, and never less than an hour.
 */
export function lateAfterMinutes(everyMinutes: number): number {
  return Math.max(everyMinutes * 3, 60);
}

export function cronState(
  run: { lastRunAt: Date; lastOk: boolean } | undefined,
  everyMinutes: number,
  now: Date
): CronState {
  if (!run) return "never";
  if (!run.lastOk) return "failing";
  const minutes = (now.getTime() - run.lastRunAt.getTime()) / 60_000;
  return minutes > lateAfterMinutes(everyMinutes) ? "late" : "ok";
}

export const cronHealthService = {
  /**
   * Stamp a run. Never throws: a heartbeat that cannot be written must not
   * turn a job that did its work into a failed request.
   */
  async record(job: CronJob, ok: boolean, error?: unknown) {
    try {
      await cronHeartbeatDal.record(job, {
        ok,
        error: error instanceof Error ? error.message : error ? String(error) : undefined,
        at: new Date(),
      });
    } catch (cause) {
      console.error(`[cron] heartbeat for ${job} not written`, cause);
    }
  },

  /** Admin or finance — the same people who read the Stripe check beside it. */
  async getForAdmin(actorUserId: string, now: Date = new Date()): Promise<CronJobStatus[]> {
    const [isAdmin, isFinance] = await Promise.all([
      userHasRole(actorUserId, "admin"),
      userHasRole(actorUserId, "finance"),
    ]);
    if (!isAdmin && !isFinance) throw new CronHealthError("FORBIDDEN_NOT_ADMIN", 403);

    const rows = new Map((await cronHeartbeatDal.list()).map((row) => [row.job, row]));
    return CRON_JOBS.map(({ job, everyMinutes }) => {
      const run = rows.get(job);
      return {
        job,
        everyMinutes,
        state: cronState(run, everyMinutes, now),
        lastRunAt: run?.lastRunAt.toISOString() ?? null,
        lastOkAt: run?.lastOkAt?.toISOString() ?? null,
        lastError: run?.lastError ?? null,
      };
    });
  },
};
