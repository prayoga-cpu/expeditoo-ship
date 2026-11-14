import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The requester hears when a driver writes to them —
 * docs/specs/requester_message_alert_spec.md.
 */

const m = vi.hoisted(() => ({
  getByUserId: vi.fn(),
  getConversationById: vi.fn(),
  lastMessageAtBefore: vi.fn(),
  getUserById: vi.fn(),
  sendRequesterMessageEmail: vi.fn(),
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: { getByUserId: m.getByUserId } }));
vi.mock("@/server/dal/messages.dal", () => ({
  messagesDAL: {
    getConversationById: m.getConversationById,
    lastMessageAtBefore: m.lastMessageAtBefore,
  },
}));
vi.mock("@/server/dal/users.dal", () => ({ getUserById: m.getUserById }));
vi.mock("@/server/services/email.service", () => ({
  emailService: { sendRequesterMessageEmail: m.sendRequesterMessageEmail },
}));
// The alert imports the quiet window from here; the rest is not under test.
vi.mock("@/server/services/driver-alerts.service", () => ({
  MESSAGE_ALERT_QUIET_MS: 30 * 60 * 1000,
}));

import { requesterAlertsService } from "../requester-alerts.service";

const QUIET = 30 * 60 * 1000;
const NOW = new Date("2026-11-14T10:00:00.000Z");
const message = (over: Record<string, unknown> = {}) => ({
  conversationId: "conv-1",
  senderId: "driver-1",
  recipientId: "requester-1",
  sentAt: NOW,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.getConversationById.mockResolvedValue({
    listing: { title: "Canapé", shipperId: "requester-1", origin: "direct" },
  });
  m.getByUserId.mockResolvedValue({ id: "carrier-1" });
  m.lastMessageAtBefore.mockResolvedValue(null);
  m.getUserById.mockResolvedValue({ id: "requester-1", name: "Nicolas", email: "n@example.com" });
  m.sendRequesterMessageEmail.mockResolvedValue(true);
});

describe("requesterAlertsService.onDriverMessage", () => {
  it("emails the requester with the job and the link only — never the driver's words", async () => {
    const result = await requesterAlertsService.onDriverMessage(message());

    expect(result).toEqual({ email: true });
    expect(m.sendRequesterMessageEmail).toHaveBeenCalledWith("n@example.com", {
      recipientName: "Nicolas",
      jobTitle: "Canapé",
      url: expect.stringMatching(/\/messages\/conv-1$/),
    });
  });

  it.each([
    ["the requester writing", { senderId: "requester-1", recipientId: "driver-1" }, "FROM_REQUESTER"],
    ["no recipient", { recipientId: null }, "NO_RECIPIENT"],
    ["a message to someone who is not the requester", { recipientId: "other" }, "NOT_TO_REQUESTER"],
  ])("stays silent for %s", async (_name, over, reason) => {
    const result = await requesterAlertsService.onDriverMessage(message(over));

    expect(result).toEqual({ email: false, skippedReason: reason });
    expect(m.sendRequesterMessageEmail).not.toHaveBeenCalled();
  });

  it("stays silent on a thread with no job (support)", async () => {
    m.getConversationById.mockResolvedValue({ listing: null });

    expect((await requesterAlertsService.onDriverMessage(message())).skippedReason).toBe("NO_JOB");
    expect(m.sendRequesterMessageEmail).not.toHaveBeenCalled();
  });

  it("stays silent on an escalated job, whose owner is the system account", async () => {
    m.getConversationById.mockResolvedValue({
      listing: { title: "Canapé", shipperId: "requester-1", origin: "expedion" },
    });

    expect((await requesterAlertsService.onDriverMessage(message())).skippedReason).toBe(
      "NOT_A_DIRECT_REQUEST"
    );
    expect(m.sendRequesterMessageEmail).not.toHaveBeenCalled();
  });

  it("stays silent when the sender is not a driver", async () => {
    m.getByUserId.mockResolvedValue(undefined);

    expect((await requesterAlertsService.onDriverMessage(message())).skippedReason).toBe(
      "NOT_A_DRIVER"
    );
    expect(m.sendRequesterMessageEmail).not.toHaveBeenCalled();
  });

  it("sends one email for a burst, none within the quiet window of the last message", async () => {
    m.lastMessageAtBefore.mockResolvedValue(new Date(NOW.getTime() - QUIET + 1000));

    expect((await requesterAlertsService.onDriverMessage(message())).skippedReason).toBe(
      "RECENTLY_ALERTED"
    );
    expect(m.sendRequesterMessageEmail).not.toHaveBeenCalled();
  });

  it("alerts again once the quiet window has passed", async () => {
    m.lastMessageAtBefore.mockResolvedValue(new Date(NOW.getTime() - QUIET - 1000));

    expect((await requesterAlertsService.onDriverMessage(message())).email).toBe(true);
  });

  it("says so when the requester has no email on file", async () => {
    m.getUserById.mockResolvedValue({ id: "requester-1", name: "Nicolas", email: null });

    expect((await requesterAlertsService.onDriverMessage(message())).skippedReason).toBe("NO_EMAIL");
  });
});
