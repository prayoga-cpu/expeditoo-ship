import { beforeEach, describe, expect, it, vi } from "vitest";

/** Texts to the driver — client_feedback_2026_10_29_spec.md §N7. */

const m = vi.hoisted(() => ({
  getByUserId: vi.fn(),
  getConversationById: vi.fn(),
  lastMessageAtBefore: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: { getByUserId: m.getByUserId } }));
vi.mock("@/server/dal/messages.dal", () => ({
  messagesDAL: {
    getConversationById: m.getConversationById,
    lastMessageAtBefore: m.lastMessageAtBefore,
  },
}));
vi.mock("@/server/services/expedion-sms.service", () => ({
  expedionSmsService: { send: m.send },
}));

import { driverSmsService, MESSAGE_SMS_QUIET_MS } from "../driver-sms.service";

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
  m.send.mockResolvedValue({ sent: true, sid: "SM1" });
});

describe("driverSmsService.onNewMessage", () => {
  it("texts the driver when their client writes, naming the job and never the message", async () => {
    await driverSmsService.onNewMessage(message());
    expect(m.send).toHaveBeenCalledWith(
      "06 12 34 56 78",
      expect.stringContaining("« Armoire »")
    );
    expect(m.send.mock.calls[0][1]).toContain("/messages/conv-1");
  });

  it("sends nothing when the driver is the one writing", async () => {
    const result = await driverSmsService.onNewMessage(
      message({ senderId: "driver-1", recipientId: "requester-1" })
    );
    expect(result).toMatchObject({ sent: false, skippedReason: "NOT_FROM_REQUESTER" });
    expect(m.send).not.toHaveBeenCalled();
  });

  it("sends nothing on a thread with no job", async () => {
    m.getConversationById.mockResolvedValue({ listing: null });
    await driverSmsService.onNewMessage(message());
    expect(m.send).not.toHaveBeenCalled();
  });

  it("sends nothing to someone who is not a driver", async () => {
    m.getByUserId.mockResolvedValue(undefined);
    const result = await driverSmsService.onNewMessage(message());
    expect(result.skippedReason).toBe("NOT_A_DRIVER");
  });

  it("turns a burst of messages into one text", async () => {
    m.lastMessageAtBefore.mockResolvedValue(new Date(NOW.getTime() - MESSAGE_SMS_QUIET_MS + 60_000));
    const result = await driverSmsService.onNewMessage(message());
    expect(result.skippedReason).toBe("RECENTLY_TEXTED");

    m.lastMessageAtBefore.mockResolvedValue(new Date(NOW.getTime() - MESSAGE_SMS_QUIET_MS - 60_000));
    await driverSmsService.onNewMessage(message());
    expect(m.send).toHaveBeenCalledTimes(1);
  });
});

describe("driverSmsService.onOfferAccepted", () => {
  it("texts the winner a link to the job", async () => {
    await driverSmsService.onOfferAccepted({ carrierUserId: "driver-1", jobTitle: "Armoire", listingId: "job-1" });
    expect(m.send).toHaveBeenCalledWith("06 12 34 56 78", expect.stringContaining("/listing/job-1"));
  });
});
