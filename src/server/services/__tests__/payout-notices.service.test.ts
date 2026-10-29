import { beforeEach, describe, expect, it, vi } from "vitest";

/** « An email to the driver for every payout » — client_feedback_2026_10_29_spec.md §N6. */

const m = vi.hoisted(() => ({
  getUserById: vi.fn(),
  sendPayoutEmail: vi.fn(),
  createNotification: vi.fn(),
}));
vi.mock("@/server/dal/users.dal", () => ({ getUserById: m.getUserById }));
vi.mock("@/server/services/email.service", () => ({
  emailService: { sendPayoutEmail: m.sendPayoutEmail },
}));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: m.createNotification },
}));

import { payoutNoticesService } from "../payout-notices.service";

beforeEach(() => {
  vi.clearAllMocks();
  m.getUserById.mockResolvedValue({ id: "d1", name: "Paul Martin", email: "paul@example.com" });
  m.sendPayoutEmail.mockResolvedValue(true);
  m.createNotification.mockResolvedValue({});
});

describe("payoutNoticesService", () => {
  it("tells the driver in the app and by email when a delivery adds to their balance", async () => {
    await payoutNoticesService.earned("d1", 16_200, "Armoire");
    expect(m.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "d1", linkUrl: "/carrier/withdrawals" })
    );
    expect(m.sendPayoutEmail).toHaveBeenCalledWith(
      "paul@example.com",
      expect.objectContaining({ kind: "earned", jobTitle: "Armoire", recipientName: "Paul Martin" })
    );
  });

  it("emails the transfer reference when a withdrawal is paid", async () => {
    await payoutNoticesService.paid("d1", 24_000, "VIR-2026-0002");
    expect(m.sendPayoutEmail).toHaveBeenCalledWith(
      "paul@example.com",
      expect.objectContaining({ kind: "paid", transferReference: "VIR-2026-0002" })
    );
  });

  it("never throws: a failed email cannot undo a delivery or a settlement", async () => {
    m.sendPayoutEmail.mockRejectedValue(new Error("resend down"));
    m.createNotification.mockRejectedValue(new Error("db down"));
    await expect(payoutNoticesService.earned("d1", 100)).resolves.toBeUndefined();
    await expect(payoutNoticesService.paid("d1", 100)).resolves.toBeUndefined();
  });

  it("sends no email to an account with none", async () => {
    m.getUserById.mockResolvedValue({ id: "d1", name: "X", email: "" });
    await payoutNoticesService.paid("d1", 100);
    expect(m.sendPayoutEmail).not.toHaveBeenCalled();
  });
});
