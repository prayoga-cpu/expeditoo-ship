import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/dal/cron-heartbeat.dal", () => ({
  cronHeartbeatDal: { list: vi.fn(), record: vi.fn() },
}));
vi.mock("@/server/services/user.service", () => ({ hasRole: vi.fn() }));

import {
  CRON_JOBS,
  CronHealthError,
  cronHealthService,
  cronState,
  lateAfterMinutes,
} from "../cron-health.service";
import { cronHeartbeatDal } from "@/server/dal/cron-heartbeat.dal";
import { hasRole } from "@/server/services/user.service";

/** client_feedback_2026_10_21_spec.md §X1 */
const NOW = new Date("2026-10-24T12:00:00.000Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

describe("cronState", () => {
  it("is « never » with no heartbeat at all", () => {
    expect(cronState(undefined, 15, NOW)).toBe("never");
  });

  it("is « failing » when the last run threw", () => {
    expect(cronState({ lastRunAt: ago(1), lastOk: false }, 15, NOW)).toBe("failing");
  });

  it("is « ok » inside three slots, and never stricter than an hour", () => {
    expect(lateAfterMinutes(5)).toBe(60);
    expect(lateAfterMinutes(24 * 60)).toBe(72 * 60);
    expect(cronState({ lastRunAt: ago(44), lastOk: true }, 15, NOW)).toBe("ok");
    expect(cronState({ lastRunAt: ago(59), lastOk: true }, 5, NOW)).toBe("ok");
  });

  it("is « late » past three missed slots", () => {
    expect(cronState({ lastRunAt: ago(61), lastOk: true }, 15, NOW)).toBe("late");
  });
});

describe("cronHealthService", () => {
  beforeEach(() => {
    vi.mocked(cronHeartbeatDal.list).mockReset();
    vi.mocked(cronHeartbeatDal.record).mockReset();
    vi.mocked(hasRole).mockReset();
  });

  it("lists every job the workflow calls, unrun ones as « never »", async () => {
    vi.mocked(hasRole).mockImplementation(async (_u, role) => role === "admin");
    vi.mocked(cronHeartbeatDal.list).mockResolvedValue([
      {
        job: "expire-listings",
        lastRunAt: ago(5),
        lastOk: true,
        lastError: null,
        lastOkAt: ago(5),
      },
    ]);

    const jobs = await cronHealthService.getForAdmin("admin-1", NOW);

    expect(jobs.map((j) => j.job)).toEqual(CRON_JOBS.map((j) => j.job));
    expect(jobs.find((j) => j.job === "expire-listings")?.state).toBe("ok");
    expect(jobs.find((j) => j.job === "expedion-escalate")).toMatchObject({
      state: "never",
      lastRunAt: null,
    });
  });

  it("refuses anyone but admin or finance, before reading anything", async () => {
    vi.mocked(hasRole).mockResolvedValue(false);

    const error = await cronHealthService
      .getForAdmin("user-1", NOW)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CronHealthError);
    expect(error).toMatchObject({ code: "FORBIDDEN_NOT_ADMIN", status: 403 });
    expect(cronHeartbeatDal.list).not.toHaveBeenCalled();
  });

  it("stamps a failed run with its message", async () => {
    await cronHealthService.record("expire-listings", false, new Error("db down"));

    expect(cronHeartbeatDal.record).toHaveBeenCalledWith(
      "expire-listings",
      expect.objectContaining({ ok: false, error: "db down" })
    );
  });

  it("never throws when the heartbeat itself cannot be written", async () => {
    vi.mocked(cronHeartbeatDal.record).mockRejectedValue(new Error("no table"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      cronHealthService.record("expire-listings", true)
    ).resolves.toBeUndefined();
    consoleError.mockRestore();
  });
});
