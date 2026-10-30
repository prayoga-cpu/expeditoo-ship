import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Alerts to the driver, by email and text — client_feedback_2026_10_29_spec.md
 * §N7 and the decision of 30 October (email now, texts once Twilio exists).
 */

const m = vi.hoisted(() => ({
  getByUserId: vi.fn(),
  getConversationById: vi.fn(),
  lastMessageAtBefore: vi.fn(),
  send: vi.fn(),
  getUserById: vi.fn(),
  sendDriverAlertEmail: vi.fn(),
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
  emailService: { sendDriverAlertEmail: m.sendDriverAlertEmail },
}));
vi.mock("@/server/services/expedion-sms.service", () => ({
  expedionSmsService: { send: m.send },
}));

import { driverAlertsService, MESSAGE_ALERT_QUIET_MS } from "../driver-alerts.service";

const NOW = new Date("2026-10-30T10:00:00.000Z");
const message = (over: Record<string, unknown> = {}) => ({
  conversationId: "conv-1",
  senderId: "requester-1",
  recipientId: "driver-1",
  sentAt: NOW,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.getConversationById.mockResolvedValue({
    listing: { title: "Armoire", shipperId: "requester-1" },
  });
  m.getByUserId.mockResolvedValue({ contactPhone: "06 12 34 56 78" });
  m.lastMessageAtBefore.mockResolvedValue(null);
  // Twilio not configured: the state production is in today.
  m.send.mockResolvedValue({ sent: false, skippedReason: "TWILIO_NOT_CONFIGURED" });
  m.getUserById.mockResolvedValue({ id: "driver-1", name: "Paul", email: "paul@example.com" });
  m.sendDriverAlertEmail.mockResolvedValue(true);
});

describe("driverAlertsService.onNewMessage", () => {
  it("emails the driver when their client writes, and texts once Twilio exists", async () => {
    const result = await driverAlertsService.onNewMessage(message());
    expect(result).toEqual({ sms: false, email: true });
    expect(m.sendDriverAlertEmail).toHaveBeenCalledWith(
      "paul@example.com",
      expect.objectContaining({ kind: "message", jobTitle: "Armoire", url: expect.stringContaining("/messages/conv-1") })
    );

    m.send.mockResolvedValue({ sent: true, sid: "SM1" });
    expect((await driverAlertsService.onNewMessage(message())).sms).toBe(true);
    expect(m.send.mock.calls[0][1]).toContain("« Armoire »");
  });

  it("alerts nobody when the driver is the one writing", async () => {
    const result = await driverAlertsService.onNewMessage(
      message({ senderId: "driver-1", recipientId: "requester-1" })
    );
    expect(result.skippedReason).toBe("NOT_FROM_REQUESTER");
    expect(m.send).not.toHaveBeenCalled();
    expect(m.sendDriverAlertEmail).not.toHaveBeenCalled();
  });

  it("alerts nobody on a thread with no job, or to someone who is not a driver", async () => {
    m.getConversationById.mockResolvedValue({ listing: null });
    await driverAlertsService.onNewMessage(message());
    m.getConversationById.mockResolvedValue({ listing: { title: "A", shipperId: "requester-1" } });
    m.getByUserId.mockResolvedValue(undefined);
    expect((await driverAlertsService.onNewMessage(message())).skippedReason).toBe("NOT_A_DRIVER");
    expect(m.sendDriverAlertEmail).not.toHaveBeenCalled();
  });

  it("turns a burst of messages into one alert", async () => {
    m.lastMessageAtBefore.mockResolvedValue(new Date(NOW.getTime() - MESSAGE_ALERT_QUIET_MS + 60_000));
    expect((await driverAlertsService.onNewMessage(message())).skippedReason).toBe("RECENTLY_ALERTED");
    expect(m.sendDriverAlertEmail).not.toHaveBeenCalled();
  });

  it("keeps the email when the text fails, and the other way round", async () => {
    m.send.mockRejectedValue(new Error("twilio down"));
    expect(await driverAlertsService.onNewMessage(message())).toEqual({ sms: false, email: true });
    m.send.mockResolvedValue({ sent: true });
    m.sendDriverAlertEmail.mockRejectedValue(new Error("resend down"));
    expect(await driverAlertsService.onNewMessage(message())).toEqual({ sms: true, email: false });
  });
});

describe("driverAlertsService.onOfferAccepted", () => {
  it("emails and texts the winner a link to the job", async () => {
    await driverAlertsService.onOfferAccepted({ carrierUserId: "driver-1", jobTitle: "Armoire", listingId: "job-1" });
    expect(m.send).toHaveBeenCalledWith("06 12 34 56 78", expect.stringContaining("/listing/job-1"));
    expect(m.sendDriverAlertEmail).toHaveBeenCalledWith(
      "paul@example.com",
      expect.objectContaining({ kind: "accepted", url: expect.stringContaining("/listing/job-1") })
    );
  });
});
