import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Covers docs/specs/invoice_at_payment_spec.md §2 — the webhook stops writing
 * the payments row itself — and payout_safety_spec.md §1: it stops writing the
 * driver's payout too.
 *
 * Without this file, reverting `stripe.service.ts` to its bare
 * `db.update(payments).set({ status: "captured" })` left the whole suite green:
 * nothing else invokes `handleWebhook`, and the capture tests call
 * `paymentsService.captureByIntent` directly.
 */

const dbSpy = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock("@/db", () => ({
  db: {
    update: dbSpy.update,
    query: {
      payments: { findFirst: vi.fn() },
      user: { findFirst: vi.fn() },
    },
  },
}));
// The webhook no longer reads shipments. This answers with a real one anyway,
// so a webhook that went back to writing the payout would reach
// `schedulePayout` and fail the case below, rather than bail out on an unknown
// shipment and pass it by accident.
vi.mock("@/server/dal/shipments.dal", () => ({
  shipmentsDal: {
    getOwnership: vi.fn().mockResolvedValue({ carrierId: "carrier-1" }),
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    accounts: {},
    transfers: { create: vi.fn() },
  },
}));
vi.mock("@/server/services/payments.service", () => ({
  paymentsService: {
    captureByIntent: vi.fn().mockResolvedValue({ id: "pay-1" }),
    schedulePayout: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }));

import { stripeService } from "../stripe.service";
import { paymentsService } from "@/server/services/payments.service";
import { stripe } from "@/lib/stripe";

const intentSucceeded = (over: Record<string, unknown> = {}) => ({
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: "pi_real_1",
      transfer_group: "shipment_ship-1",
      metadata: { shipmentId: "ship-1" },
      ...over,
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

describe("payment_intent.succeeded", () => {
  it("settles through the service instead of writing the row", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      intentSucceeded() as never
    );

    await stripeService.handleWebhook("{}", "sig");

    expect(paymentsService.captureByIntent).toHaveBeenCalledWith("pi_real_1");
    // The bare UPDATE it replaced set no `capturedAt` and had no status
    // predicate, so it could resurrect a refunded payment.
    expect(dbSpy.update).not.toHaveBeenCalled();
  });

  it("schedules no payout — the driver is owed at delivery, not at capture", async () => {
    // Since the client pays at booking, the capture is the award. Scheduling
    // here made pay for a job nobody had driven yet withdrawable at once;
    // `settleDelivery` is the only writer now.
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      intentSucceeded() as never
    );

    await stripeService.handleWebhook("{}", "sig");

    expect(paymentsService.captureByIntent).toHaveBeenCalled();
    expect(paymentsService.schedulePayout).not.toHaveBeenCalled();
  });

  it("ignores an intent this platform did not group", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      intentSucceeded({ transfer_group: null }) as never
    );

    await stripeService.handleWebhook("{}", "sig");

    expect(paymentsService.captureByIntent).not.toHaveBeenCalled();
  });
});
