import { beforeEach, describe, expect, it, vi } from "vitest";

// Covers docs/specs/feedback_spec.md §3 and §8.

// vi.mock is hoisted above every const, so the doubles have to be too.
const { dal, getUserById, getUsersByRole, createNotification } = vi.hoisted(
  () => ({
    dal: {
      create: vi.fn(),
      getById: vi.fn(),
      listForUser: vi.fn(),
      listQueue: vi.fn(),
      countsByStatus: vi.fn(),
      update: vi.fn(),
      countRecentByUser: vi.fn(),
    },
    getUserById: vi.fn(),
    getUsersByRole: vi.fn(),
    createNotification: vi.fn(),
  })
);

vi.mock("@/server/dal/feedback.dal", () => dal);
vi.mock("@/server/dal/users.dal", () => ({
  getUserById: (...a: unknown[]) => getUserById(...a),
  getUsersByRole: (...a: unknown[]) => getUsersByRole(...a),
}));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: {
    createNotification: (...a: unknown[]) => createNotification(...a),
  },
}));

import { feedbackService, FeedbackError } from "../feedback.service";
import { submitFeedbackSchema } from "@/server/dto/feedback.dto";

const STAFF = { userId: "admin1", isAdmin: true, isOperator: false };
const OPERATOR = { userId: "op1", isAdmin: false, isOperator: true };
const CIVILIAN = { userId: "u1", isAdmin: false, isOperator: false };

function row(overrides = {}) {
  return {
    id: "fb1",
    userId: "u1",
    userName: "Ada",
    userEmail: "ada@example.com",
    userRole: "shipper",
    type: "bug",
    surface: "home",
    pathname: "/home",
    description: "It broke",
    screenshotUrls: [],
    appVersion: "2.37.2",
    locale: "fr",
    status: "OPEN",
    priority: "medium",
    devNote: null,
    resolvedAt: null,
    resolvedByUserId: null,
    createdAt: new Date("2026-09-10T10:00:00Z"),
    updatedAt: new Date("2026-09-10T10:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserById.mockResolvedValue({
    id: "u1",
    name: "Ada",
    email: "ada@example.com",
    roles: [{ role: "shipper" }],
  });
  getUsersByRole.mockResolvedValue([]);
  createNotification.mockResolvedValue(undefined);
  dal.create.mockImplementation(async (data: Record<string, unknown>) =>
    row(data)
  );
});

describe("submit", () => {
  const input = submitFeedbackSchema.parse({
    type: "bug",
    surface: "home",
    description: "The dashboard will not load",
    locale: "fr",
  });

  it("stamps identity, role and build from the server, never the client", async () => {
    await feedbackService.submit(input, CIVILIAN);

    expect(dal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        userName: "Ada",
        userEmail: "ada@example.com",
        userRole: "shipper",
        appVersion: expect.any(String),
      })
    );
  });

  it("leaves status and priority to the column defaults", async () => {
    await feedbackService.submit(input, CIVILIAN);

    const payload = dal.create.mock.calls[0][0];
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("priority");
  });

  it("needs no role — that is the whole requirement", async () => {
    await expect(feedbackService.submit(input, CIVILIAN)).resolves.toBeTruthy();
  });

  it("returns the submitter's view, without the internal note", async () => {
    dal.create.mockResolvedValueOnce(row({ devNote: "secret" }));

    const view = await feedbackService.submit(input, CIVILIAN);

    expect(view).not.toHaveProperty("devNote");
    expect(view).not.toHaveProperty("priority");
  });

  // The single most important test in this file.
  it("keeps the report when telling staff about it fails", async () => {
    getUsersByRole.mockRejectedValue(new Error("notifications are down"));

    await expect(feedbackService.submit(input, CIVILIAN)).resolves.toBeTruthy();
    expect(dal.create).toHaveBeenCalledTimes(1);
  });
});

describe("announce", () => {
  it("treats an admin who is also an operator as one inbox", async () => {
    getUsersByRole.mockImplementation(async (role: string) =>
      role === "operator"
        ? [{ id: "same" }, { id: "onlyOperator" }]
        : [{ id: "same" }]
    );

    await feedbackService.announce(row() as never);

    expect(createNotification).toHaveBeenCalledTimes(2);
  });

  it("points staff at the console", async () => {
    getUsersByRole.mockResolvedValue([{ id: "admin1" }]);

    await feedbackService.announce(row() as never);

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ linkUrl: "/admin/feedback" })
    );
  });
});

describe("listMine", () => {
  it("scopes to the viewer, which is the whole authorisation", async () => {
    dal.listForUser.mockResolvedValue([row({ devNote: "secret" })]);

    const views = await feedbackService.listMine(CIVILIAN);

    expect(dal.listForUser).toHaveBeenCalledWith("u1", 50);
    expect(views[0]).not.toHaveProperty("devNote");
  });
});

describe("listQueue", () => {
  const query = { limit: 25, offset: 0 } as never;

  beforeEach(() => {
    dal.listQueue.mockResolvedValue({ items: [], total: 0 });
    dal.countsByStatus.mockResolvedValue({ OPEN: 3 });
  });

  it("refuses anyone who is not staff, and does not touch the database", async () => {
    await expect(feedbackService.listQueue(query, CIVILIAN)).rejects.toMatchObject(
      { code: "FORBIDDEN", status: 403 }
    );
    expect(dal.listQueue).not.toHaveBeenCalled();
  });

  it.each([
    ["an admin", STAFF],
    ["an operator", OPERATOR],
  ])("allows %s", async (_who, viewer) => {
    await expect(
      feedbackService.listQueue(query, viewer)
    ).resolves.toBeTruthy();
  });

  it("zero-fills every status, so a tile reads 0 rather than vanishing", async () => {
    const { meta } = await feedbackService.listQueue(query, STAFF);

    expect(meta.counts).toEqual({
      OPEN: 3,
      IN_PROGRESS: 0,
      NEEDS_REVIEW: 0,
      RESOLVED: 0,
      ARCHIVED: 0,
    });
  });
});

describe("triage", () => {
  beforeEach(() => {
    dal.getById.mockResolvedValue(row());
    dal.update.mockImplementation(async (_id: string, patch: object) =>
      row(patch)
    );
  });

  it("refuses a non-staff viewer without reading the ticket", async () => {
    await expect(
      feedbackService.triage("fb1", { status: "RESOLVED" }, CIVILIAN)
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(dal.getById).not.toHaveBeenCalled();
  });

  it("404s a ticket that is not there", async () => {
    dal.getById.mockResolvedValue(undefined);

    await expect(
      feedbackService.triage("nope", { status: "RESOLVED" }, STAFF)
    ).rejects.toMatchObject({ code: "FEEDBACK_NOT_FOUND", status: 404 });
  });

  it("records who resolved it and when, on the way in", async () => {
    await feedbackService.triage("fb1", { status: "RESOLVED" }, STAFF);

    expect(dal.update).toHaveBeenCalledWith(
      "fb1",
      expect.objectContaining({
        status: "RESOLVED",
        resolvedAt: expect.any(Date),
        resolvedByUserId: "admin1",
      })
    );
  });

  it("does not rewrite who closed it when it was already closed", async () => {
    dal.getById.mockResolvedValue(row({ status: "RESOLVED" }));

    await feedbackService.triage("fb1", { status: "RESOLVED" }, STAFF);

    const patch = dal.update.mock.calls[0][1];
    expect(patch).not.toHaveProperty("resolvedAt");
  });

  it("clears the resolution when a ticket is reopened", async () => {
    dal.getById.mockResolvedValue(row({ status: "RESOLVED" }));

    await feedbackService.triage("fb1", { status: "OPEN" }, STAFF);

    expect(dal.update).toHaveBeenCalledWith(
      "fb1",
      expect.objectContaining({ resolvedAt: null, resolvedByUserId: null })
    );
  });

  it("lets any status follow any status — a triage board is not a state machine", async () => {
    dal.getById.mockResolvedValue(row({ status: "ARCHIVED" }));

    await expect(
      feedbackService.triage("fb1", { status: "OPEN" }, STAFF)
    ).resolves.toBeTruthy();
  });

  it("saving a note alone touches neither status nor the resolution", async () => {
    await feedbackService.triage("fb1", { devNote: "looked at it" }, STAFF);

    const patch = dal.update.mock.calls[0][1];
    expect(patch).toEqual({ devNote: "looked at it" });
  });

  it("throws its own error class, so api-response can translate it", async () => {
    await expect(
      feedbackService.triage("fb1", { status: "RESOLVED" }, CIVILIAN)
    ).rejects.toBeInstanceOf(FeedbackError);
  });
});
