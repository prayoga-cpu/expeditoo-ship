import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * driver_types_spec.md §3 and §9: the admin alert leads with the type and opens
 * the file; an approval congratulates the driver in French, in the app and by
 * email, and a mail that fails never fails the approval.
 */

const dal = vi.hoisted(() => ({
  carriers: {
    getById: vi.fn(),
    getByUserId: vi.fn(),
    create: vi.fn(async (data: object) => ({ id: "c-new", ...data })),
    update: vi.fn(async (_id: string, data: object) => ({ id: "c1", ...data })),
    setAllDocumentsAccepted: vi.fn().mockResolvedValue(undefined),
    upsertDriverLink: vi.fn().mockResolvedValue(undefined),
  },
  notify: vi.fn().mockResolvedValue({}),
  users: {
    getUsersByRole: vi.fn(),
    getUserById: vi.fn(),
    assignRoleIfMissing: vi.fn().mockResolvedValue(undefined),
  },
  email: {
    sendDriverApprovedEmail: vi.fn().mockResolvedValue(true),
    sendDriverApplicationSubmittedEmail: vi.fn().mockResolvedValue(true),
    sendMissingDocumentsEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => await fn({}) },
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: dal.carriers }));
vi.mock("@/server/dal/shipments.dal", () => ({ shipmentsDal: {} }));
vi.mock("@/server/dal/offers.dal", () => ({ offersDal: {} }));
vi.mock("@/server/dal/users.dal", () => dal.users);
vi.mock("@/server/services/email.service", () => ({ emailService: dal.email }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: dal.notify },
}));
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }));

import { carrierService } from "../carrier.service";

const file = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  userId: "u1",
  kind: "professional",
  status: "submitted",
  companyName: "Paul Martin EI",
  city: "Lyon",
  ...over,
});
const account = { id: "u1", name: "Paul Martin", email: "paul@example.com" };
const noticeTo = (userId: string) =>
  dal.notify.mock.calls.map(([n]) => n as Record<string, string>).filter((n) => n.userId === userId);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  dal.carriers.getById.mockResolvedValue(file());
  dal.carriers.getByUserId.mockResolvedValue(file());
  dal.users.getUserById.mockResolvedValue(account);
  dal.users.getUsersByRole.mockResolvedValue([{ id: "a1", email: "admin@example.com" }]);
  dal.email.sendDriverApprovedEmail.mockResolvedValue(true);
});

describe("approve congratulates the driver", () => {
  it("mails a professional and points them at the missions board", async () => {
    const approved = await carrierService.approve("admin-1", "c1");

    expect(approved).toMatchObject({ status: "approved", approvedBy: "admin-1" });
    expect(dal.email.sendDriverApprovedEmail).toHaveBeenCalledTimes(1);
    expect(dal.email.sendDriverApprovedEmail).toHaveBeenCalledWith("paul@example.com", {
      name: "Paul Martin",
      kind: "professional",
      actionUrl: expect.stringMatching(/\/expedion$/),
    });
    expect(noticeTo("u1")).toEqual([
      expect.objectContaining({
        title: "Félicitations, votre dossier est approuvé",
        message: "Vous pouvez dès maintenant consulter les missions et faire vos offres.",
        linkUrl: "/expedion",
      }),
    ]);
  });

  it("mails an in-house driver and points them at « Livraisons », with no word about offers", async () => {
    dal.carriers.getById.mockResolvedValue(file({ kind: "private" }));

    await carrierService.approve("admin-1", "c1");

    expect(dal.email.sendDriverApprovedEmail).toHaveBeenCalledWith("paul@example.com", {
      name: "Paul Martin",
      kind: "private",
      actionUrl: expect.stringMatching(/\/driver\/shipments$/),
    });
    const [notice] = noticeTo("u1");
    expect(notice).toMatchObject({
      title: "Félicitations, vous êtes chauffeur Expeditop",
      linkUrl: "/driver/shipments",
    });
    expect(notice.message).toMatch(/Expeditop vous attribuera vos courses/);
    expect(notice.message).not.toMatch(/offre/);
  });

  it("still approves when the mail cannot be sent", async () => {
    dal.email.sendDriverApprovedEmail.mockRejectedValue(new Error("Resend is down"));

    const approved = await carrierService.approve("admin-1", "c1");

    expect(approved).toMatchObject({ status: "approved" });
    expect(dal.users.assignRoleIfMissing).toHaveBeenCalledWith("u1", "carrier", "admin-1", {});
    expect(noticeTo("u1")).toHaveLength(1);
  });

  it("still approves when the account cannot be read, and sends no mail", async () => {
    dal.users.getUserById.mockRejectedValue(new Error("database down"));

    await expect(carrierService.approve("admin-1", "c1")).resolves.toMatchObject({
      status: "approved",
    });
    expect(dal.email.sendDriverApprovedEmail).not.toHaveBeenCalled();
  });

  it("still approves when the notification fails, and mails all the same", async () => {
    dal.notify.mockRejectedValueOnce(new Error("notifications down"));

    await expect(carrierService.approve("admin-1", "c1")).resolves.toMatchObject({
      status: "approved",
    });
    expect(dal.email.sendDriverApprovedEmail).toHaveBeenCalledTimes(1);
  });

  it("sends the mail only once the approval is written", async () => {
    await carrierService.approve("admin-1", "c1");

    expect(dal.carriers.update.mock.invocationCallOrder[0]).toBeLessThan(
      dal.email.sendDriverApprovedEmail.mock.invocationCallOrder[0]
    );
  });

  it("says nothing on a repeat approval, which is only the role backfill", async () => {
    dal.carriers.getById.mockResolvedValue(file({ status: "approved" }));

    await carrierService.approve("admin-1", "c1");

    expect(dal.email.sendDriverApprovedEmail).not.toHaveBeenCalled();
    expect(dal.notify).not.toHaveBeenCalled();
  });
});

describe("grantRole congratulates as an approval does", () => {
  it("mails an account made an in-house driver from « Gérer le rôle »", async () => {
    dal.carriers.getByUserId.mockResolvedValue(undefined);

    await carrierService.grantRole("admin-1", "u1", "driver");

    expect(dal.email.sendDriverApprovedEmail).toHaveBeenCalledWith(
      "paul@example.com",
      expect.objectContaining({ kind: "private" })
    );
    expect(noticeTo("u1")[0].title).toBe("Félicitations, vous êtes chauffeur Expeditop");
  });

  it("mails by the role granted, not the kind the pending file had", async () => {
    dal.carriers.getByUserId.mockResolvedValue(file({ kind: "private", status: "submitted" }));

    await carrierService.grantRole("admin-1", "u1", "carrier");

    expect(dal.email.sendDriverApprovedEmail).toHaveBeenCalledWith(
      "paul@example.com",
      expect.objectContaining({ kind: "professional" })
    );
  });

  it("says nothing when the file was already approved", async () => {
    dal.carriers.getByUserId.mockResolvedValue(file({ status: "approved" }));

    await carrierService.grantRole("admin-1", "u1", "carrier");

    expect(dal.email.sendDriverApprovedEmail).not.toHaveBeenCalled();
    expect(dal.notify).not.toHaveBeenCalled();
  });

  it("still grants the role when the mail fails", async () => {
    dal.carriers.getByUserId.mockResolvedValue(undefined);
    dal.email.sendDriverApprovedEmail.mockRejectedValue(new Error("Resend is down"));

    await expect(carrierService.grantRole("admin-1", "u1", "driver")).resolves.toBeUndefined();
    expect(dal.users.assignRoleIfMissing).toHaveBeenCalledWith("u1", "driver", "admin-1", {});
  });
});

describe("the other decisions are told in French", () => {
  it("rejects with a French title and the admin's own reason", async () => {
    await carrierService.reject("admin-1", "c1", "SIRET illisible");

    expect(noticeTo("u1")).toEqual([
      expect.objectContaining({ title: "Dossier chauffeur refusé", message: "SIRET illisible" }),
    ]);
    expect(dal.email.sendDriverApprovedEmail).not.toHaveBeenCalled();
  });

  it("suspends with a French title", async () => {
    await carrierService.suspend("c1", "Assurance expirée");

    expect(noticeTo("u1")).toEqual([
      expect.objectContaining({ title: "Compte chauffeur suspendu", message: "Assurance expirée" }),
    ]);
  });

  it("stays silent on a reinstatement, as before", async () => {
    dal.carriers.getById.mockResolvedValue(file({ status: "suspended" }));

    await carrierService.reinstate({ userId: "admin-1", isAdmin: true }, "c1");

    expect(dal.notify).not.toHaveBeenCalled();
    expect(dal.email.sendDriverApprovedEmail).not.toHaveBeenCalled();
  });
});

describe("the admin alert names the type and opens the file", () => {
  beforeEach(() => {
    dal.carriers.getByUserId.mockResolvedValue(file({ status: "draft", kind: "private" }));
  });

  it("passes the kind and a link to the file itself", async () => {
    await carrierService.submitApplication("u1");

    expect(dal.email.sendDriverApplicationSubmittedEmail).toHaveBeenCalledWith(
      "admin@example.com",
      {
        applicantName: "Paul Martin",
        companyName: "Paul Martin EI",
        city: "Lyon",
        kind: "private",
        reviewUrl: expect.stringMatching(/\/admin\/drivers\?tab=applications&file=c1$/),
      }
    );
  });

  it.each([
    ["private", "Nouveau dossier chauffeur — Particulier (interne)"],
    ["professional", "Nouveau dossier chauffeur — Professionnel"],
  ])("leads the %s notification with the type", async (kind, title) => {
    dal.carriers.getByUserId.mockResolvedValue(file({ status: "draft", kind }));

    await carrierService.submitApplication("u1");

    expect(noticeTo("a1")).toEqual([
      expect.objectContaining({ title, linkUrl: "/admin/drivers?tab=applications&file=c1" }),
    ]);
  });
});
