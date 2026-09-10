import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The payments service talks to the db directly (no DAL), so the harness is a
// minimal in-memory stand-in for exactly the Drizzle chains it uses:
// insert().values().returning(), update().set().where().returning(), and
// db.query.<table>.findFirst/findMany. `eq` is mocked to a {column, value}
// marker the harness matches rows against.
const harness = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Leaf = { column: string; value: unknown };
  type Where = Leaf | { all: Where[] } | undefined;

  const paymentsTable = {
    id: "id",
    shipmentId: "shipmentId",
    listingId: "listingId",
    createdAt: "createdAt",
  };
  const payoutsTable = {
    id: "id",
    shipmentId: "shipmentId",
    carrierId: "carrierId",
    status: "status",
  };
  const userTable = { id: "id", stripeCustomerId: "stripeCustomerId" };

  const paymentRows: Row[] = [];
  const payoutRows: Row[] = [];
  const userRows: Row[] = [];
  const rowsFor = (table: object) =>
    table === paymentsTable
      ? paymentRows
      : table === payoutsTable
        ? payoutRows
        : userRows;

  // `and(...)` composes into `{ all: [...] }` so a multi-column predicate is
  // actually applied. Without it every clause but the shape of the first is
  // ignored, and a test that means to pin "only a *scheduled* payout" passes
  // whatever the row says.
  const matches = (row: Row, where: Where): boolean => {
    if (!where) return true;
    if ("all" in where) return where.all.every((w) => matches(row, w));
    return row[where.column] === where.value;
  };

  const query = (store: Row[]) => ({
    findFirst: async (opts: { where?: Where } = {}) =>
      store.find((row) => matches(row, opts.where)),
    // `orderBy` is accepted and ignored: insertion order is already newest-last
    // in this harness, and the only caller reverses it, so the rows are handed
    // back reversed to match `desc(createdAt)`.
    findMany: async (opts: { where?: Where; orderBy?: unknown } = {}) => {
      const hit = store.filter((row) => matches(row, opts.where));
      return opts.orderBy ? [...hit].reverse() : hit;
    },
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
        // Drizzle applies an update whether or not `.returning()` is awaited,
        // so the harness must too: `markFailed` fires and forgets, and a
        // returning-only harness left every failed charge reading `pending`.
        where: (where: Where) => {
          const hit = rowsFor(table).filter((row) => matches(row, where));
          hit.forEach((row) => Object.assign(row, patch));
          return Object.assign(Promise.resolve(hit), {
            returning: async () => hit,
          });
        },
      }),
    }),
    query: {
      payments: query(paymentRows),
      payouts: query(payoutRows),
      user: query(userRows),
    },
  };

  const reset = () => {
    paymentRows.length = 0;
    payoutRows.length = 0;
    userRows.length = 0;
  };

  return {
    db,
    paymentsTable,
    payoutsTable,
    userTable,
    paymentRows,
    payoutRows,
    userRows,
    reset,
  };
});

vi.mock("@/db", () => ({ db: harness.db }));
vi.mock("@/db/schema/payments", () => ({
  payments: harness.paymentsTable,
  payouts: harness.payoutsTable,
}));
vi.mock("@/db/schema/users", () => ({ user: harness.userTable }));
vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  eq: (column: unknown, value: unknown) => ({ column, value }),
  and: (...parts: unknown[]) => ({ all: parts.filter(Boolean) }),
  desc: (column: unknown) => ({ column, direction: "desc" }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    paymentIntents: { create: vi.fn() },
    paymentMethods: { list: vi.fn() },
    refunds: { create: vi.fn() },
    transfers: { create: vi.fn() },
  },
}));

import {
  paymentsService,
  PaymentError,
  commissionFor,
  COMMISSION_RATE,
} from "../payments.service";
import { stripe } from "@/lib/stripe";

// ========================================
// Fixtures
// ========================================

const chargeParams = (over: Record<string, unknown> = {}) => ({
  shipperId: "shipper-1",
  shipmentId: "ship-1",
  listingId: "job-1",
  amountCents: 18_000,
  // A test shipper has no saved card - the whole point of the mock path.
  stripeCustomerId: null,
  source: "stripe" as const,
  ...over,
});

/** A customer whose card Stripe will hand back to an off-session charge. */
const givenSavedCard = (id = "pm_1") =>
  vi.mocked(stripe.paymentMethods.list).mockResolvedValue({
    data: [{ id }],
  } as never);

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
// Commission math — 10% at source, the rest owed and withdrawable
// ========================================
//
// Most of these expectations derive from the constant rather than restating
// it, so they keep testing the arithmetic — rate applied, rounds to whole
// cents, never more than was charged — when the rate next moves. The one that
// does pin the number is marked as pinning it on purpose.

describe("commissionFor", () => {
  it("applies the configured rate to the job price", () => {
    expect(commissionFor(18_000)).toBe(Math.round(18_000 * COMMISSION_RATE));
  });

  it("rounds to the nearest cent", () => {
    expect(commissionFor(999)).toBe(Math.round(999 * COMMISSION_RATE));
    expect(commissionFor(994)).toBe(Math.round(994 * COMMISSION_RATE));
    expect(Number.isInteger(commissionFor(999))).toBe(true);
  });

  it("never takes more than was charged", () => {
    expect(commissionFor(18_000)).toBeLessThanOrEqual(18_000);
  });

  it("takes a tenth, and leaves the rest owed to the driver", () => {
    // Pinned deliberately: the rate has moved once already, and the withdrawal
    // flow only makes sense while the driver's share is non-zero. Changing the
    // constant without revisiting this file should fail loudly.
    expect(COMMISSION_RATE).toBe(0.1);
    expect(commissionFor(18_000)).toBe(1_800);
    expect(18_000 - commissionFor(18_000)).toBe(16_200);
  });
});

// ========================================
// Charging an Expedion job — the money moved in another app
// ========================================

describe("chargeForShipment (source: expedion)", () => {
  beforeEach(() => {
    delete process.env.MOCK_PAYMENTS;
  });

  it("records the money as captured without charging anyone", async () => {
    const payment = await paymentsService.chargeForShipment(
      chargeParams({ source: "expedion" })
    );

    expect(payment.status).toBe("captured");
    expect(payment.source).toBe("expedion");
    expect(payment.capturedAt).toBeInstanceOf(Date);
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("carries no PaymentIntent, because the charge is not ours", async () => {
    const payment = await paymentsService.chargeForShipment(
      chargeParams({ source: "expedion" })
    );

    expect(payment.stripePaymentIntentId).toBeUndefined();
  });

  it("awards an escalated job whose owner has no card at all", async () => {
    // The regression this whole branch exists for. Escalated listings belong to
    // `EXPEDION_SYSTEM_USER_ID`, an account nobody signs into and no card
    // belongs to, so the old hold hit PAYMENT_METHOD_REQUIRED and
    // `compensateFailedAward` unwound every award made outside mock mode.
    await expect(
      paymentsService.chargeForShipment(
        chargeParams({ source: "expedion", stripeCustomerId: null })
      )
    ).resolves.toMatchObject({ status: "captured" });
  });

  it("still records the commission owed on the job", async () => {
    const payment = await paymentsService.chargeForShipment(
      chargeParams({ source: "expedion" })
    );

    expect(payment.commissionCents).toBe(commissionFor(18_000));
  });
});

// ========================================
// Charging a direct job — taken at booking, not held
// ========================================

describe("chargeForShipment (source: stripe, flag off)", () => {
  beforeEach(() => {
    delete process.env.MOCK_PAYMENTS;
  });

  it("requires a Stripe customer", async () => {
    expect(
      await codeFrom(() => paymentsService.chargeForShipment(chargeParams()))
    ).toBe("PAYMENT_METHOD_REQUIRED");
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("requires a card that is still attached to that customer", async () => {
    // The card was collected at posting; if it is gone by the award it was
    // detached in between.
    vi.mocked(stripe.paymentMethods.list).mockResolvedValue({ data: [] } as never);

    expect(
      await codeFrom(() =>
        paymentsService.chargeForShipment(
          chargeParams({ stripeCustomerId: "cus_1" })
        )
      )
    ).toBe("PAYMENT_METHOD_REQUIRED");
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("takes the money outright rather than holding it", async () => {
    givenSavedCard();
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({
      id: "pi_real_1",
      status: "succeeded",
    } as never);

    const payment = await paymentsService.chargeForShipment(
      chargeParams({ stripeCustomerId: "cus_1" })
    );

    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 18_000,
        capture_method: "automatic",
        confirm: true,
        off_session: true,
        payment_method: "pm_1",
      })
    );
    expect(payment.status).toBe("captured");
    expect(payment.capturedAt).toBeInstanceOf(Date);
    expect(payment.stripePaymentIntentId).toBe("pi_real_1");
  });

  it("fails the charge when the intent does not succeed", async () => {
    givenSavedCard();
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({
      id: "pi_real_1",
      // What an off-session SCA challenge looks like: nobody is there to answer
      // it, so the charge fails rather than waiting.
      status: "requires_action",
    } as never);

    expect(
      await codeFrom(() =>
        paymentsService.chargeForShipment(
          chargeParams({ stripeCustomerId: "cus_1" })
        )
      )
    ).toBe("PAYMENT_CHARGE_FAILED");

    expect(harness.paymentRows[0]).toMatchObject({
      status: "failed",
      // Kept so support can find the attempt at Stripe.
      stripePaymentIntentId: "pi_real_1",
    });
  });

  it("marks the row failed when Stripe throws", async () => {
    givenSavedCard();
    vi.mocked(stripe.paymentIntents.create).mockRejectedValue(
      new Error("card_declined")
    );

    expect(
      await codeFrom(() =>
        paymentsService.chargeForShipment(
          chargeParams({ stripeCustomerId: "cus_1" })
        )
      )
    ).toBe("PAYMENT_CHARGE_FAILED");

    expect(harness.paymentRows[0]).toMatchObject({
      status: "failed",
      failureReason: "card_declined",
    });
  });

  it("never charges a shipment that is already paid for", async () => {
    givenSavedCard();
    harness.paymentRows.push({
      id: "pay-1",
      shipmentId: "ship-1",
      status: "captured",
      source: "stripe",
    });

    const payment = await paymentsService.chargeForShipment(
      chargeParams({ stripeCustomerId: "cus_1" })
    );

    expect(payment.id).toBe("pay-1");
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(harness.paymentRows).toHaveLength(1);
  });
});

// ========================================
// Charging under MOCK_PAYMENTS
// ========================================

describe("chargeForShipment (mock path)", () => {
  it("captures without touching Stripe", async () => {
    const payment = await paymentsService.chargeForShipment(chargeParams());

    expect(payment.status).toBe("captured");
    expect(payment.source).toBe("stripe");
    expect(payment.stripePaymentIntentId).toBe("pi_mock_ship-1");
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("does not demand a saved payment method", async () => {
    await expect(
      paymentsService.chargeForShipment(chargeParams({ stripeCustomerId: null }))
    ).resolves.toBeDefined();
  });

  it("writes the same row shape as the real path", async () => {
    const payment = await paymentsService.chargeForShipment(chargeParams());

    expect(payment).toMatchObject({
      userId: "shipper-1",
      shipmentId: "ship-1",
      listingId: "job-1",
      amountCents: 18_000,
      commissionCents: commissionFor(18_000),
      currency: "eur",
      transferGroup: "shipment_ship-1",
    });
  });
});

// ========================================
// hasSavedCard — read before a direct job reaches the board
// ========================================

describe("hasSavedCard", () => {
  it("is false for a user with no Stripe customer", async () => {
    harness.userRows.push({ id: "shipper-1", stripeCustomerId: null });

    expect(await paymentsService.hasSavedCard("shipper-1")).toBe(false);
    // No customer means no cards. Asking Stripe would be a wasted round trip.
    expect(stripe.paymentMethods.list).not.toHaveBeenCalled();
  });

  it("is false for a customer with no attached card", async () => {
    harness.userRows.push({ id: "shipper-1", stripeCustomerId: "cus_1" });
    vi.mocked(stripe.paymentMethods.list).mockResolvedValue({ data: [] } as never);

    expect(await paymentsService.hasSavedCard("shipper-1")).toBe(false);
  });

  it("is true once a card is attached", async () => {
    harness.userRows.push({ id: "shipper-1", stripeCustomerId: "cus_1" });
    givenSavedCard();

    expect(await paymentsService.hasSavedCard("shipper-1")).toBe(true);
  });

  it("is false for a user who does not exist", async () => {
    expect(await paymentsService.hasSavedCard("ghost")).toBe(false);
  });
});

// ========================================
// Refund — cancelling an awarded job gives the money back
// ========================================

describe("refundForJob", () => {
  it("refunds a mock charge without calling Stripe", async () => {
    await paymentsService.chargeForShipment(chargeParams());

    const refunded = await paymentsService.refundForJob("job-1");

    expect(refunded?.status).toBe("refunded");
    expect(refunded?.refundedAt).toBeInstanceOf(Date);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("refunds a real charge at Stripe", async () => {
    harness.paymentRows.push({
      id: "pay-1",
      shipmentId: "ship-1",
      listingId: "job-1",
      status: "captured",
      source: "stripe",
      stripePaymentIntentId: "pi_real_1",
    });

    const refunded = await paymentsService.refundForJob("job-1");

    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_real_1" })
    );
    expect(refunded?.status).toBe("refunded");
  });

  it("refuses to refund money Expedion took", async () => {
    await paymentsService.chargeForShipment(
      chargeParams({ source: "expedion" })
    );

    expect(
      await codeFrom(() => paymentsService.refundForJob("job-1"))
    ).toBe("REFUND_NOT_LOCAL");
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("is idempotent: refunding twice calls Stripe once", async () => {
    harness.paymentRows.push({
      id: "pay-1",
      shipmentId: "ship-1",
      listingId: "job-1",
      status: "captured",
      source: "stripe",
      stripePaymentIntentId: "pi_real_1",
    });

    await paymentsService.refundForJob("job-1");
    const again = await paymentsService.refundForJob("job-1");

    expect(again?.status).toBe("refunded");
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
  });

  it("leaves a charge that never completed exactly as it is", async () => {
    // Nothing was taken, so there is nothing to give back — and calling it
    // "refunded" would show an operator a refund that never happened.
    harness.paymentRows.push({
      id: "pay-1",
      shipmentId: "ship-1",
      listingId: "job-1",
      status: "failed",
      source: "stripe",
    });

    const result = await paymentsService.refundForJob("job-1");

    expect(result?.status).toBe("failed");
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("returns null when the job was never paid for", async () => {
    expect(await paymentsService.refundForJob("ghost")).toBeNull();
  });

  it("finds the money even when its shipment is gone", async () => {
    // A withdrawal kills the shipment and leaves the job on the board. Keyed on
    // the shipment, this refund would walk straight past the client's money.
    harness.paymentRows.push({
      id: "pay-1",
      shipmentId: null,
      listingId: "job-1",
      status: "captured",
      source: "stripe",
      stripePaymentIntentId: "pi_real_1",
    });

    const refunded = await paymentsService.refundForJob("job-1");

    expect(refunded?.status).toBe("refunded");
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_real_1" })
    );
  });

  it("prefers the captured row over a dead attempt on the same job", async () => {
    harness.paymentRows.push({
      id: "pay-failed",
      shipmentId: "ship-0",
      listingId: "job-1",
      status: "failed",
      source: "stripe",
    });
    harness.paymentRows.push({
      id: "pay-live",
      shipmentId: "ship-1",
      listingId: "job-1",
      status: "captured",
      source: "stripe",
      stripePaymentIntentId: "pi_real_1",
    });

    const refunded = await paymentsService.refundForJob("job-1");

    expect(refunded?.id).toBe("pay-live");
  });
});

// ========================================
// One Expedion payment, however many awards
// ========================================

describe("paymentsService.chargeForShipment — the escalated lane", () => {
  it("re-points the existing charge instead of recording a second one", async () => {
    // Award -> withdraw -> re-award mints a fresh shipment each time, but the
    // Expedion client paid once, for the quote. A second `captured` row would
    // inflate recorded revenue by the whole price of the job.
    await paymentsService.chargeForShipment(
      chargeParams({ source: "expedion" })
    );

    const second = await paymentsService.chargeForShipment(
      chargeParams({ source: "expedion", shipmentId: "ship-2" })
    );

    expect(harness.paymentRows).toHaveLength(1);
    expect(second.shipmentId).toBe("ship-2");
    expect(second.status).toBe("captured");
  });

  it("carries the replacement driver's price, not the one who walked", async () => {
    // `schedulePayout` reads `amountCents` and `commissionCents` off this row
    // to decide what the driver is owed. Moving only the pointer pays the
    // second driver the first one's bid — short or over, depending which way
    // the two happen to differ.
    await paymentsService.chargeForShipment(
      chargeParams({ source: "expedion", amountCents: 40_000 })
    );

    const second = await paymentsService.chargeForShipment(
      chargeParams({
        source: "expedion",
        shipmentId: "ship-2",
        amountCents: 48_000,
      })
    );

    expect(second.amountCents).toBe(48_000);
    expect(second.commissionCents).toBe(commissionFor(48_000));
    expect(second.transferGroup).toBe("shipment_ship-2");
  });
});

// ========================================
// Money that has gone back owes the driver nothing
// ========================================

describe("paymentsService.cancelPayoutForShipment", () => {
  it("voids a payout the webhook scheduled at award", async () => {
    harness.payoutRows.push({
      id: "pyt-1",
      shipmentId: "ship-1",
      carrierId: "carrier-1",
      status: "scheduled",
    });

    const cancelled = await paymentsService.cancelPayoutForShipment("ship-1");

    expect(cancelled?.status).toBe("cancelled");
  });

  it("returns null when there is nothing scheduled", async () => {
    expect(await paymentsService.cancelPayoutForShipment("ship-1")).toBeNull();
  });

  it("leaves a payout that has already been paid alone", async () => {
    harness.payoutRows.push({
      id: "pyt-1",
      shipmentId: "ship-1",
      carrierId: "carrier-1",
      status: "paid",
    });

    expect(await paymentsService.cancelPayoutForShipment("ship-1")).toBeNull();
    expect(harness.payoutRows[0].status).toBe("paid");
  });
});

// ========================================
// Payout — commission held at source
// ========================================

describe("paymentsService.schedulePayout", () => {
  it("owes the carrier the price minus the commission", async () => {
    await paymentsService.chargeForShipment(chargeParams());

    const payout = await paymentsService.schedulePayout("ship-1", "carrier-1");

    expect(payout).toMatchObject({
      carrierId: "carrier-1",
      shipmentId: "ship-1",
      amountCents: 18_000 - commissionFor(18_000),
      currency: "eur",
      status: "scheduled",
    });
  });

  it("is idempotent: rescheduling returns the existing payout", async () => {
    await paymentsService.chargeForShipment(chargeParams());
    const first = await paymentsService.schedulePayout("ship-1", "carrier-1");

    const second = await paymentsService.schedulePayout("ship-1", "carrier-1");

    expect(second.id).toBe(first.id);
    expect(harness.payoutRows).toHaveLength(1);
  });
});

// ========================================
// executePayout — the destination lives on the user row
// ========================================
//
// `payouts.carrier_id` references `user.id`, and Connect onboarding writes
// `stripeAccountId` onto that same user row. This was read off
// `carriers.stripe_account_id` instead — a column nothing in the codebase has
// ever written — so a driver who finished onboarding was refused
// `CARRIER_ACCOUNT_MISSING` forever, with no write path that could clear it.

/** A scheduled payout for `carrier-1`, the way a delivery mints one. */
const givenScheduledPayout = async () => {
  await paymentsService.chargeForShipment(chargeParams());
  return await paymentsService.schedulePayout("ship-1", "carrier-1");
};

/** The driver's user row after Connect onboarding has reached `status`. */
const givenConnectAccount = (status: string, id: string | null = "acct_1") =>
  harness.userRows.push({
    id: "carrier-1",
    stripeAccountId: id,
    stripeAccountStatus: status,
  });

describe("paymentsService.executePayout", () => {
  it("sends the transfer to the account onboarding wrote on the user", async () => {
    const payout = await givenScheduledPayout();
    givenConnectAccount("active");
    vi.mocked(stripe.transfers.create).mockResolvedValue({
      id: "tr_1",
    } as never);

    const paid = await paymentsService.executePayout(payout.id);

    expect(stripe.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: "acct_1",
        amount: 18_000 - commissionFor(18_000),
        currency: "eur",
        transfer_group: "shipment_ship-1",
      })
    );
    expect(paid).toMatchObject({ status: "paid", stripeTransferId: "tr_1" });
    expect(paid.paidAt).toBeInstanceOf(Date);
  });

  it("refuses a driver who has never connected an account", async () => {
    const payout = await givenScheduledPayout();
    // The shape every driver starts in, and the one that matters: the row
    // always exists (`payouts.carrier_id` references it), `stripe_account_id`
    // is null and `stripe_account_status` defaults to `pending`. Asserting
    // this against a *missing* user row would prove nothing the foreign key
    // does not already forbid.
    givenConnectAccount("pending", null);

    expect(await codeFrom(() => paymentsService.executePayout(payout.id))).toBe(
      "CARRIER_ACCOUNT_MISSING"
    );
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it("refuses a carrier id no user row answers to", async () => {
    const payout = await givenScheduledPayout();

    expect(await codeFrom(() => paymentsService.executePayout(payout.id))).toBe(
      "CARRIER_ACCOUNT_MISSING"
    );
  });

  it("refuses a driver whose onboarding is not finished", async () => {
    const payout = await givenScheduledPayout();
    // What `createConnectAccount` writes. Only `account.updated` promotes it.
    givenConnectAccount("pending");

    expect(await codeFrom(() => paymentsService.executePayout(payout.id))).toBe(
      "CARRIER_ACCOUNT_NOT_READY"
    );
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it("refuses an account Stripe has restricted", async () => {
    const payout = await givenScheduledPayout();
    givenConnectAccount("restricted");

    expect(await codeFrom(() => paymentsService.executePayout(payout.id))).toBe(
      "CARRIER_ACCOUNT_NOT_READY"
    );
  });

  it("leaves the payout scheduled when it refuses", async () => {
    // The refusals are not failed transfers, and `failed` would take the money
    // out of `withdrawalsDal.availableFor` — earned, then gone, because the
    // driver had not finished onboarding.
    const payout = await givenScheduledPayout();
    givenConnectAccount("pending");

    await codeFrom(() => paymentsService.executePayout(payout.id));

    expect(harness.payoutRows[0]).toMatchObject({
      id: payout.id,
      status: "scheduled",
    });
    expect(harness.payoutRows[0]).not.toHaveProperty("failureReason");
  });

  it("marks the payout failed when Stripe refuses the transfer", async () => {
    const payout = await givenScheduledPayout();
    givenConnectAccount("active");
    vi.mocked(stripe.transfers.create).mockRejectedValue(
      new Error("insufficient funds")
    );

    expect(await codeFrom(() => paymentsService.executePayout(payout.id))).toBe(
      "PAYOUT_FAILED"
    );
    expect(harness.payoutRows[0]).toMatchObject({
      status: "failed",
      failureReason: "insufficient funds",
    });
  });

  it("is idempotent: an already paid payout is not transferred twice", async () => {
    const payout = await givenScheduledPayout();
    harness.payoutRows[0].status = "paid";
    givenConnectAccount("active");

    const again = await paymentsService.executePayout(payout.id);

    expect(again.status).toBe("paid");
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it("refuses a payout a refund has already voided", async () => {
    // `cancelPayoutForShipment` writes this when the client's money goes back.
    // Transferring it anyway pays the driver their share of a job nobody
    // bought, out of the platform's own balance.
    const payout = await givenScheduledPayout();
    harness.payoutRows[0].status = "cancelled";
    givenConnectAccount("active");

    expect(await codeFrom(() => paymentsService.executePayout(payout.id))).toBe(
      "PAYOUT_CANCELLED"
    );
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(harness.payoutRows[0].status).toBe("cancelled");
  });

  it("refuses a payout a withdrawal request has already claimed", async () => {
    // The by-hand withdrawal flow is how this money actually moves today.
    // Once a request has claimed the row, `availableFor` stops counting it —
    // so a transfer here is the same earned money paid a second time, with
    // nothing left able to notice.
    const payout = await givenScheduledPayout();
    harness.payoutRows[0].withdrawalId = "wd-1";
    givenConnectAccount("active");

    expect(await codeFrom(() => paymentsService.executePayout(payout.id))).toBe(
      "PAYOUT_ALREADY_CLAIMED"
    );
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it("404s on a payout that does not exist", async () => {
    expect(await codeFrom(() => paymentsService.executePayout("ghost"))).toBe(
      "PAYOUT_NOT_FOUND"
    );
  });
});

// ========================================
// The whole money chain — book → pay → deliver → payout
// ========================================

describe("mock money chain end to end", () => {
  it("captures at booking and owes the driver at delivery", async () => {
    // The shape of the change: the money is already taken by the time the
    // shipment exists, so delivery adds a payout rather than a capture.
    const payment = await paymentsService.chargeForShipment(chargeParams());
    expect(payment.status).toBe("captured");

    const payout = await paymentsService.schedulePayout("ship-1", "carrier-1");
    expect(payout.status).toBe("scheduled");
    expect(payout.amountCents).toBe(18_000 - commissionFor(18_000));

    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });
});
