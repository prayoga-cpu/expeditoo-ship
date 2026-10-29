import { beforeEach, describe, expect, it, vi } from "vitest";

/** client_feedback_2026_10_29_spec.md §REQ-02 — Actif / Absent / Suspendu / Désinscrit. */

const dal = vi.hoisted(() => ({
  carriers: {
    getById: vi.fn(),
    getByUserId: vi.fn(),
    update: vi.fn(async (_id: string, data: object) => ({ id: "c1", ...data })),
  },
  shipments: { countLiveForCarrier: vi.fn() },
  offers: { withdrawAllPendingForCarrier: vi.fn() },
  notify: vi.fn().mockResolvedValue({}),
  users: {
    getUsersByRole: vi.fn(),
    getUserById: vi.fn(),
  },
  email: { sendDriverApplicationSubmittedEmail: vi.fn().mockResolvedValue(true) },
}));

vi.mock("@/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => await fn({}) },
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: dal.carriers }));
vi.mock("@/server/dal/shipments.dal", () => ({ shipmentsDal: dal.shipments }));
vi.mock("@/server/dal/offers.dal", () => ({ offersDal: dal.offers }));
vi.mock("@/server/dal/users.dal", () => dal.users);
vi.mock("@/server/services/email.service", () => ({ emailService: dal.email }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: dal.notify },
}));
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }));

import { carrierService } from "../carrier.service";

const carrier = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  userId: "driver",
  status: "approved",
  absentSince: null,
  absentUntil: null,
  ...over,
});
const self = { userId: "driver" };
const admin = { userId: "boss", isAdmin: true };
const stranger = { userId: "someone" };
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  dal.carriers.getByUserId.mockResolvedValue(carrier());
  dal.carriers.getById.mockResolvedValue(carrier());
  dal.shipments.countLiveForCarrier.mockResolvedValue(0);
});

describe("setAvailability", () => {
  it("marks the caller's own account away until a date", async () => {
    const until = tomorrow();
    await carrierService.setAvailability(self, null, { absent: true, until, reason: "Congés" });
    expect(dal.carriers.update).toHaveBeenCalledWith("c1", {
      absentSince: expect.any(Date),
      absentUntil: new Date(until),
      absenceReason: "Congés",
    });
    expect(dal.notify).not.toHaveBeenCalled();
  });

  it("marks away with no end date", async () => {
    await carrierService.setAvailability(self, null, { absent: true, until: null, reason: null });
    expect(dal.carriers.update).toHaveBeenCalledWith("c1", expect.objectContaining({ absentUntil: null }));
  });

  it("ends an absence", async () => {
    dal.carriers.getByUserId.mockResolvedValue(carrier({ absentSince: new Date() }));
    await carrierService.setAvailability(self, null, { absent: false });
    expect(dal.carriers.update).toHaveBeenCalledWith("c1", {
      absentSince: null,
      absentUntil: null,
      absenceReason: null,
    });
  });

  it("refuses a return date already past", async () => {
    await expect(
      carrierService.setAvailability(self, null, {
        absent: true,
        until: new Date(Date.now() - 60_000).toISOString(),
        reason: null,
      })
    ).rejects.toMatchObject({ code: "ABSENCE_END_IN_PAST", status: 422 });
  });

  it.each(["suspended", "deregistered", "submitted"])("refuses to mark a %s account away", async (status) => {
    dal.carriers.getByUserId.mockResolvedValue(carrier({ status }));
    await expect(
      carrierService.setAvailability(self, null, { absent: true, until: null, reason: null })
    ).rejects.toMatchObject({ code: "CARRIER_NOT_ACTIVE" });
  });

  it("lets an admin mark someone else away, and tells them", async () => {
    await carrierService.setAvailability(admin, "c1", { absent: true, until: null, reason: null });
    expect(dal.carriers.update).toHaveBeenCalled();
    expect(dal.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "driver" }));
  });

  it("answers a stranger naming someone else's account as not found", async () => {
    await expect(
      carrierService.setAvailability(stranger, "c1", { absent: true, until: null, reason: null })
    ).rejects.toMatchObject({ code: "CARRIER_NOT_FOUND", status: 404 });
    expect(dal.carriers.update).not.toHaveBeenCalled();
  });
});

describe("deregister", () => {
  it("withdraws every standing bid and closes the account", async () => {
    await carrierService.deregister(self, null, "J'arrête");
    expect(dal.offers.withdrawAllPendingForCarrier).toHaveBeenCalledWith("driver", {});
    expect(dal.carriers.update).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        status: "deregistered",
        deregisteredAt: expect.any(Date),
        deregistrationReason: "J'arrête",
        absentSince: null,
      }),
      {}
    );
  });

  it("is refused while a run is still owed to somebody", async () => {
    dal.shipments.countLiveForCarrier.mockResolvedValue(1);
    await expect(carrierService.deregister(self, null, null)).rejects.toMatchObject({
      code: "CARRIER_HAS_LIVE_RUNS",
      status: 409,
    });
    expect(dal.offers.withdrawAllPendingForCarrier).not.toHaveBeenCalled();
    expect(dal.carriers.update).not.toHaveBeenCalled();
  });

  it("is a no-op on an account already deregistered", async () => {
    dal.carriers.getByUserId.mockResolvedValue(carrier({ status: "deregistered" }));
    await carrierService.deregister(self, null, null);
    expect(dal.carriers.update).not.toHaveBeenCalled();
  });

  it("is refused to a stranger", async () => {
    await expect(carrierService.deregister(stranger, "c1", "x")).rejects.toMatchObject({
      code: "CARRIER_NOT_FOUND",
    });
  });
});

describe("reinstate", () => {
  it("is for admins only", async () => {
    await expect(carrierService.reinstate(self, "c1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("brings a suspended driver back", async () => {
    dal.carriers.getById.mockResolvedValue(carrier({ status: "suspended" }));
    await carrierService.reinstate(admin, "c1");
    expect(dal.carriers.update).toHaveBeenCalledWith("c1", { status: "approved", suspensionReason: null });
  });
});

describe("requireApproved", () => {
  it("refuses an absent driver by name, not as unapproved", async () => {
    dal.carriers.getByUserId.mockResolvedValue(carrier({ absentSince: new Date() }));
    await expect(carrierService.requireApproved("driver")).rejects.toMatchObject({ code: "CARRIER_ABSENT" });
  });
});

/** client_feedback_2026_10_29_spec.md §REQ-07 */
describe("submitApplication alerts the admins", () => {
  beforeEach(() => {
    dal.carriers.getByUserId.mockResolvedValue(
      carrier({ status: "draft", companyName: "Paul Martin EI", city: "Lyon" })
    );
    dal.users.getUsersByRole.mockResolvedValue([
      { id: "a1", email: "admin1@example.com" },
      { id: "a2", email: "admin2@example.com" },
    ]);
    dal.users.getUserById.mockResolvedValue({ id: "driver", name: "Paul Martin" });
  });

  it("notifies and emails every admin, naming the applicant and the company only", async () => {
    await carrierService.submitApplication("driver");

    expect(dal.notify).toHaveBeenCalledTimes(2);
    expect(dal.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "a1", linkUrl: "/admin/applications" })
    );
    expect(dal.email.sendDriverApplicationSubmittedEmail).toHaveBeenCalledWith(
      "admin2@example.com",
      expect.objectContaining({
        applicantName: "Paul Martin",
        companyName: "Paul Martin EI",
        city: "Lyon",
        reviewUrl: expect.stringMatching(/\/admin\/applications$/),
      })
    );
  });

  it("still submits when the alert fails", async () => {
    dal.users.getUsersByRole.mockRejectedValue(new Error("down"));
    const result = await carrierService.submitApplication("driver");
    expect(result).toMatchObject({ status: "submitted" });
  });
});
