import { beforeEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  record: vi.fn(),
  captureByIntent: vi.fn(),
  recordStripePayment: vi.fn(),
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
vi.mock("@/server/services/expedion.service", () => ({
  expedionService: { recordStripePayment: spies.recordStripePayment },
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
  // One case makes the stamp fail; the rest expect it to succeed.
  spies.record.mockResolvedValue(undefined);
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

describe("stripeService.handleWebhook — an Expedion payment (launch_readiness_spec.md §F)", () => {
  const expedionEvent = (metadata: Record<string, string>, transfer_group: string | null = null) => ({
    type: "payment_intent.succeeded",
    livemode: true,
    data: { object: { id: "pi_exp", transfer_group, amount_received: 12_000, metadata } },
  });

  it("hands an intent carrying a quote id to the Expedion service, not to payments", async () => {
    spies.constructEvent.mockReturnValue(expedionEvent({ recordID: "q_1", devisId: "q_1" }));
    spies.recordStripePayment.mockResolvedValue("marked");

    await stripeService.handleWebhook("{}", "sig");

    expect(spies.recordStripePayment).toHaveBeenCalledWith({
      quoteId: "q_1",
      intentId: "pi_exp",
      amountCents: 12_000,
    });
    expect(spies.captureByIntent).not.toHaveBeenCalled();
  });

  it("reads `devisId` when `recordID` is absent", async () => {
    spies.constructEvent.mockReturnValue(expedionEvent({ devisId: "q_2" }));
    spies.recordStripePayment.mockResolvedValue("unknown_quote");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await stripeService.handleWebhook("{}", "sig");

    expect(spies.recordStripePayment).toHaveBeenCalledWith(
      expect.objectContaining({ quoteId: "q_2" })
    );
    log.mockRestore();
  });

  it("leaves this platform's own charges to the payments path", async () => {
    spies.constructEvent.mockReturnValue(expedionEvent({ recordID: "q_1" }, "listing_1"));

    await stripeService.handleWebhook("{}", "sig");

    expect(spies.captureByIntent).toHaveBeenCalledWith("pi_exp");
    expect(spies.recordStripePayment).not.toHaveBeenCalled();
  });

  it("does nothing with an intent that names neither", async () => {
    spies.constructEvent.mockReturnValue(expedionEvent({}));

    await stripeService.handleWebhook("{}", "sig");

    expect(spies.recordStripePayment).not.toHaveBeenCalled();
    expect(spies.captureByIntent).not.toHaveBeenCalled();
  });
});
