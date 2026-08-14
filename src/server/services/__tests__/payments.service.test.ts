import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The payments service talks to the db directly (no DAL), so the harness is a
// minimal in-memory stand-in for exactly the Drizzle chains it uses:
// insert().values().returning(), update().set().where().returning(), and
// db.query.<table>.findFirst/findMany. `eq` is mocked to a {column, value}
// marker the harness matches rows against.
const harness = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Where = { column: string; value: unknown } | undefined;

  const paymentsTable = { id: "id", shipmentId: "shipmentId" };
  const payoutsTable = { id: "id", shipmentId: "shipmentId", carrierId: "carrierId" };

  const paymentRows: Row[] = [];
  const payoutRows: Row[] = [];
  const rowsFor = (table: object) =>
    table === paymentsTable ? paymentRows : payoutRows;

  const matches = (row: Row, where: Where) =>
    !where || row[where.column] === where.value;

  const query = (store: Row[]) => ({
    findFirst: async (opts: { where?: Where } = {}) =>
      store.find((row) => matches(row, opts.where)),
    findMany: async (opts: { where?: Where } = {}) =>
      store.filter((row) => matches(row, opts.where)),
  });

  const db = {
    insert: (table: object) => ({
      values: (values: Row) => ({
        returning: async () => {
          const row = { ...values };
          rowsFor(table).push(row);
          return [row];
        },
      }),
    }),
    update: (table: object) => ({
      set: (patch: Row) => ({
        where: (where: Where) => ({
          returning: async () => {
            const hit = rowsFor(table).filter((row) => matches(row, where));
            hit.forEach((row) => Object.assign(row, patch));
            return hit;
          },
        }),
      }),
    }),
    query: { payments: query(paymentRows), payouts: query(payoutRows) },
  };

  const reset = () => {
    paymentRows.length = 0;
    payoutRows.length = 0;
  };

  return { db, paymentsTable, payoutsTable, paymentRows, payoutRows, reset };
});

vi.mock("@/db", () => ({ db: harness.db }));
vi.mock("@/db/schema/payments", () => ({
  payments: harness.paymentsTable,
  payouts: harness.payoutsTable,
}));
vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  eq: (column: unknown, value: unknown) => ({ column, value }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    paymentIntents: { create: vi.fn(), capture: vi.fn(), cancel: vi.fn() },
    transfers: { create: vi.fn() },
  },
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: {} }));

import {
  paymentsService,
  PaymentError,
  commissionFor,
} from "../payments.service";
import { stripe } from "@/lib/stripe";

// ========================================
// Fixtures
// ========================================

const authoriseParams = (over: Record<string, unknown> = {}) => ({
  shipperId: "shipper-1",
  shipmentId: "ship-1",
  listingId: "job-1",
  amountCents: 18_000,
  // A test shipper has no saved card - the whole point of the mock path.
  stripeCustomerId: null,
  ...over,
});

/** Runs `fn` and returns the PaymentError code it threw. */
async function codeFrom(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof PaymentError) return error.code;
    throw error;
  }
  throw new Error("expected the call to throw");
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.reset();
  process.env.MOCK_PAYMENTS = "true";
});

afterEach(() => {
  delete process.env.MOCK_PAYMENTS;
});

// ========================================
// Commission math — ROADMAP.md §1, 10% at source
// ========================================

describe("commissionFor", () => {
  it("takes 10% of the job price", () => {
    expect(commissionFor(18_000)).toBe(1_800);
  });

  it("rounds to the nearest cent", () => {
    expect(commissionFor(999)).toBe(100);
    expect(commissionFor(994)).toBe(99);
  });
});

// ========================================
// Authorise — MOCK_PAYMENTS skips Stripe entirely
// ========================================

describe("paymentsService.authoriseForShipment (mock path)", () => {
  it("records an authorised hold without touching Stripe", async () => {
    const result = await paymentsService.authoriseForShipment(authoriseParams());

    expect(result.payment.status).toBe("authorised");
    expect(result.payment.authorisedAt).toBeInstanceOf(Date);
    expect(result.clientSecret).toBeNull();
    expect(result.requiresAction).toBe(false);
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("stamps a synthetic intent id carrying the mock prefix", async () => {
    const { payment } = await paymentsService.authoriseForShipment(
      authoriseParams()
    );

    expect(payment.stripePaymentIntentId).toBe("pi_mock_ship-1");
  });

  it("writes the same row shape as the real path", async () => {
    const { payment } = await paymentsService.authoriseForShipment(
      authoriseParams()
    );

    expect(payment).toMatchObject({
      userId: "shipper-1",
      shipmentId: "ship-1",
      listingId: "job-1",
      amountCents: 18_000,
      commissionCents: 1_800,
      currency: "eur",
      transferGroup: "shipment_ship-1",
    });
  });

  it("does not demand a saved payment method", async () => {
    await expect(
      paymentsService.authoriseForShipment(
        authoriseParams({ stripeCustomerId: null })
      )
    ).resolves.toBeDefined();
  });
});

describe("paymentsService.authoriseForShipment (flag off)", () => {
  beforeEach(() => {
    delete process.env.MOCK_PAYMENTS;
  });

  it("still requires a Stripe customer", async () => {
    expect(
      await codeFrom(() =>
        paymentsService.authoriseForShipment(authoriseParams())
      )
    ).toBe("PAYMENT_METHOD_REQUIRED");
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("still creates a real manual-capture PaymentIntent", async () => {
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({
      id: "pi_real_1",
      status: "requires_capture",
      client_secret: "cs_1",
    } as never);

    const result = await paymentsService.authoriseForShipment(
      authoriseParams({ stripeCustomerId: "cus_1" })
    );

    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ capture_method: "manual", amount: 18_000 })
    );
    expect(result.payment.status).toBe("authorised");
    expect(result.payment.stripePaymentIntentId).toBe("pi_real_1");
  });
});

// ========================================
// Capture — mock holds advance the row without a Stripe call
// ========================================

describe("paymentsService.captureForShipment", () => {
  it("captures a mock hold without calling Stripe", async () => {
    await paymentsService.authoriseForShipment(authoriseParams());

    const captured = await paymentsService.captureForShipment("ship-1");

    expect(captured.status).toBe("captured");
    expect(captured.capturedAt).toBeInstanceOf(Date);
    expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
  });

  it("recognises the pi_mock_ prefix even after the flag is turned off", async () => {
    await paymentsService.authoriseForShipment(authoriseParams());
    delete process.env.MOCK_PAYMENTS;

    const captured = await paymentsService.captureForShipment("ship-1");

    expect(captured.status).toBe("captured");
    expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
  });

  it("still calls Stripe for a real intent when the flag is off", async () => {
    delete process.env.MOCK_PAYMENTS;
    harness.paymentRows.push({
      id: "pay-1",
      shipmentId: "ship-1",
      status: "authorised",
      stripePaymentIntentId: "pi_real_1",
    });

    await paymentsService.captureForShipment("ship-1");

    expect(stripe.paymentIntents.capture).toHaveBeenCalledWith("pi_real_1");
  });

  it("is idempotent: capturing twice never double-charges", async () => {
    await paymentsService.authoriseForShipment(authoriseParams());
    await paymentsService.captureForShipment("ship-1");

    const again = await paymentsService.captureForShipment("ship-1");

    expect(again.status).toBe("captured");
  });

  it("refuses a hold that never authorised", async () => {
    harness.paymentRows.push({
      id: "pay-1",
      shipmentId: "ship-1",
      status: "pending",
      stripePaymentIntentId: "pi_mock_ship-1",
    });

    expect(await codeFrom(() => paymentsService.captureForShipment("ship-1")))
      .toBe("PAYMENT_NOT_AUTHORISED");
  });

  it("throws when no payment exists for the shipment", async () => {
    expect(await codeFrom(() => paymentsService.captureForShipment("ghost")))
      .toBe("PAYMENT_NOT_FOUND");
  });
});

// ========================================
// Release — cancelling an awarded job frees the mock hold
// ========================================

describe("paymentsService.releaseForShipment", () => {
  it("releases a mock hold without calling Stripe", async () => {
    await paymentsService.authoriseForShipment(authoriseParams());

    const released = await paymentsService.releaseForShipment("ship-1");

    expect(released?.status).toBe("released");
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it("refuses to release money already captured", async () => {
    await paymentsService.authoriseForShipment(authoriseParams());
    await paymentsService.captureForShipment("ship-1");

    expect(await codeFrom(() => paymentsService.releaseForShipment("ship-1")))
      .toBe("PAYMENT_ALREADY_CAPTURED");
  });
});

// ========================================
// Payout — commission held at source
// ========================================

describe("paymentsService.schedulePayout", () => {
  it("owes the carrier the price minus the 10% commission", async () => {
    await paymentsService.authoriseForShipment(authoriseParams());
    await paymentsService.captureForShipment("ship-1");

    const payout = await paymentsService.schedulePayout("ship-1", "carrier-1");

    expect(payout).toMatchObject({
      carrierId: "carrier-1",
      shipmentId: "ship-1",
      amountCents: 16_200,
      currency: "eur",
      status: "scheduled",
    });
  });

  it("is idempotent: rescheduling returns the existing payout", async () => {
    await paymentsService.authoriseForShipment(authoriseParams());
    const first = await paymentsService.schedulePayout("ship-1", "carrier-1");

    const second = await paymentsService.schedulePayout("ship-1", "carrier-1");

    expect(second.id).toBe(first.id);
    expect(harness.payoutRows).toHaveLength(1);
  });
});

// ========================================
// The whole money chain — accept → deliver → capture → payout
// ========================================

describe("mock money chain end to end", () => {
  it("progresses authorised → captured → scheduled with zero Stripe calls", async () => {
    const { payment } = await paymentsService.authoriseForShipment(
      authoriseParams()
    );
    expect(payment.status).toBe("authorised");

    const captured = await paymentsService.captureForShipment("ship-1");
    expect(captured.status).toBe("captured");

    const payout = await paymentsService.schedulePayout("ship-1", "carrier-1");
    expect(payout.status).toBe("scheduled");
    expect(payout.amountCents).toBe(18_000 - commissionFor(18_000));

    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });
});
