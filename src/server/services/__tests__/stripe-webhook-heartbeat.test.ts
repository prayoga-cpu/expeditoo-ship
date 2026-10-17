import { beforeEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  record: vi.fn(),
  captureByIntent: vi.fn(),
}));

vi.mock("@/db", () => ({ db: { update: vi.fn() } }));
vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: spies.constructEvent } },
}));
vi.mock("@/server/dal/stripe-webhook-heartbeat.dal", () => ({
  stripeWebhookHeartbeatDal: { record: spies.record },
}));
vi.mock("@/server/services/payments.service", () => ({
  paymentsService: { captureByIntent: spies.captureByIntent },
}));

import { stripeService } from "../stripe.service";

/**
 * launch_readiness_spec.md §B.4 — every verified event leaves a heartbeat, so
 * the admin can see Stripe reaching this deployment; a failed stamp never
 * fails the event.
 */

const event = {
  type: "payment_intent.succeeded",
  livemode: true,
  data: { object: { id: "pi_1", transfer_group: "g" } },
};

beforeEach(() => {
  vi.clearAllMocks();
  spies.constructEvent.mockReturnValue(event);
});

describe("stripeService.handleWebhook — heartbeat", () => {
  it("records the type and mode of a verified event, then handles it", async () => {
    await stripeService.handleWebhook("{}", "sig");

    expect(spies.record).toHaveBeenCalledWith({
      type: "payment_intent.succeeded",
      livemode: true,
      at: expect.any(Date),
    });
    expect(spies.captureByIntent).toHaveBeenCalledWith("pi_1");
  });

  it("records nothing for an event whose signature fails", async () => {
    spies.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found");
    });

    await expect(stripeService.handleWebhook("{}", "bad")).rejects.toThrow(
      /signature verification failed/
    );
    expect(spies.record).not.toHaveBeenCalled();
  });

  it("still handles the event when the stamp cannot be written", async () => {
    spies.record.mockRejectedValue(new Error("relation does not exist"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(stripeService.handleWebhook("{}", "sig")).resolves.toBeUndefined();
    expect(spies.captureByIntent).toHaveBeenCalledWith("pi_1");
    spy.mockRestore();
  });
});
