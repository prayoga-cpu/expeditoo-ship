import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Covers docs/specs/invoice_at_payment_spec.md §2 and §5 — the wire from money
 * moving to the document that records it, and back again when it is returned.
 *
 * The question this file answers is *when*, not *what*: the invoicing service
 * has its own suite. What is exercised here is that every transition into
 * `captured` runs the hook, that nothing else can make that transition, and
 * that giving the money back raises the correction.
 */

const harness = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Where = { column: string; value: unknown } | undefined;

  const paymentsTable = {
    id: "id",
    shipmentId: "shipmentId",
    listingId: "listingId",
    createdAt: "createdAt",
    stripePaymentIntentId: "stripePaymentIntentId",
  };
  const payoutsTable = { id: "id", shipmentId: "shipmentId" };
  const userTable = { id: "id" };

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
      user: query([]),
    },
  };

  return {
    db,
    paymentsTable,
    payoutsTable,
    userTable,
    paymentRows,
    reset: () => {
      paymentRows.length = 0;
      payoutRows.length = 0;
    },
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
  // The refund lookup orders by creation; the harness keeps insertion order,
  // which is the same thing here.
  desc: (column: unknown) => column,
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    paymentIntents: { create: vi.fn() },
    paymentMethods: { list: vi.fn() },
    refunds: { create: vi.fn() },
    transfers: { create: vi.fn() },
  },
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: {} }));
vi.mock("@/server/services/invoices.service", () => ({
  invoicesService: {
    createFromPayment: vi.fn().mockResolvedValue({ id: "inv-1" }),
    createCreditNoteForPayment: vi.fn().mockResolvedValue({ id: "cn-1" }),
  },
}));

import { paymentsService } from "../payments.service";
import { invoicesService } from "@/server/services/invoices.service";

const chargeParams = (over: Record<string, unknown> = {}) => ({
  shipperId: "client-1",
  shipmentId: "ship-1",
  listingId: "job-1",
  amountCents: 18_000,
  stripeCustomerId: null,
  source: "stripe" as const,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  harness.reset();
  // `clearAllMocks` forgets calls, not implementations, so a case that makes
  // either hook reject would otherwise poison every case after it.
  vi.mocked(invoicesService.createFromPayment).mockResolvedValue({
    id: "inv-1",
  } as never);
  vi.mocked(invoicesService.createCreditNoteForPayment).mockResolvedValue({
    id: "cn-1",
  } as never);
  process.env.MOCK_PAYMENTS = "true";
});

afterEach(() => {
  delete process.env.MOCK_PAYMENTS;
});

// ========================================
// The charge raises the document
// ========================================

describe("chargeForShipment", () => {
  it("documents the charge the moment it settles", async () => {
    // This used to wait for delivery — days later, and only if the job
    // completed at all (spec §1).
    const payment = await paymentsService.chargeForShipment(chargeParams());

    expect(invoicesService.createFromPayment).toHaveBeenCalledWith(payment.id);
  });

  it("documents nothing on the escalated lane", async () => {
    await paymentsService.chargeForShipment(
      chargeParams({ source: "expedion" })
    );

    // The money is recorded — that client really was debited, in Expedion —
    // and no Expeditoo document is raised for it (spec §3).
    const [row] = harness.paymentRows;
    expect(row.source).toBe("expedion");
    expect(row.status).toBe("captured");
    expect(invoicesService.createFromPayment).not.toHaveBeenCalled();
  });

  it("keeps the money taken when the document cannot be written", async () => {
    vi.mocked(invoicesService.createFromPayment).mockRejectedValue(
      new Error("sequence unavailable")
    );

    const payment = await paymentsService.chargeForShipment(chargeParams());

    // A paperwork failure must never un-award a job whose client is debited.
    expect(payment.status).toBe("captured");
  });

  it("raises no second document when the same shipment is charged twice", async () => {
    await paymentsService.chargeForShipment(chargeParams());
    await paymentsService.chargeForShipment(chargeParams());

    expect(invoicesService.createFromPayment).toHaveBeenCalledTimes(1);
  });
});

// ========================================
// The webhook is the other capture writer
// ========================================

describe("captureByIntent", () => {
  const givenPayment = (over: Record<string, unknown> = {}) => {
    harness.paymentRows.push({
      id: "pay-1",
      userId: "client-1",
      stripePaymentIntentId: "pi_real_1",
      status: "pending",
      source: "stripe",
      ...over,
    });
  };

  it("settles a pending payment, stamps when, and documents it", async () => {
    givenPayment();

    const row = await paymentsService.captureByIntent("pi_real_1");

    expect(row?.status).toBe("captured");
    expect(row?.capturedAt).toBeInstanceOf(Date);
    expect(invoicesService.createFromPayment).toHaveBeenCalledWith("pay-1");
  });

  it("settles a payment whose first attempt was marked failed", async () => {
    // `chargeForShipment` keeps the intent id on a failed row, so an intent
    // that settles asynchronously arrives here.
    givenPayment({ status: "failed", failureReason: "intent processing" });

    const row = await paymentsService.captureByIntent("pi_real_1");

    expect(row?.status).toBe("captured");
    expect(row?.failureReason).toBeNull();
  });

  it("never resurrects a refunded payment", async () => {
    // With no status predicate this flipped a refunded row back to captured
    // and raised a second document for money already returned.
    givenPayment({ status: "refunded" });

    const row = await paymentsService.captureByIntent("pi_real_1");

    expect(row?.status).toBe("refunded");
    expect(invoicesService.createFromPayment).not.toHaveBeenCalled();
  });

  it("does nothing twice for a payment already settled", async () => {
    givenPayment({ status: "captured" });

    await paymentsService.captureByIntent("pi_real_1");

    expect(invoicesService.createFromPayment).not.toHaveBeenCalled();
  });

  it("ignores an intent this platform never wrote", async () => {
    expect(await paymentsService.captureByIntent("pi_unknown")).toBeNull();
  });
});

// ========================================
// Giving it back
// ========================================

describe("markRefunded", () => {
  beforeEach(() => {
    harness.paymentRows.push({
      id: "pay-1",
      shipmentId: "ship-1",
      listingId: "job-1",
      status: "captured",
      source: "stripe",
      stripePaymentIntentId: "pi_mock_ship-1",
    });
  });

  it("corrects the document it gave a receipt for", async () => {
    await paymentsService.markRefunded("pay-1");

    expect(invoicesService.createCreditNoteForPayment).toHaveBeenCalledWith(
      "pay-1"
    );
  });

  it("gives the money back even when the correction fails", async () => {
    vi.mocked(invoicesService.createCreditNoteForPayment).mockRejectedValue(
      new Error("sequence unavailable")
    );

    const row = await paymentsService.markRefunded("pay-1");

    expect(row.status).toBe("refunded");
  });

  it("is reached by the job-level refund too", async () => {
    await paymentsService.refundForJob("job-1");

    expect(invoicesService.createCreditNoteForPayment).toHaveBeenCalledWith(
      "pay-1"
    );
  });

  it("retries the correction on a payment already given back", async () => {
    // `markRefunded` contains its own paperwork failure, so a swallowed credit
    // note would otherwise be unreachable forever: both refund entry points
    // refuse a payment that is already `refunded`. This is the backstop
    // `settleDelivery` gives the invoice side.
    harness.paymentRows[0].status = "refunded";

    await paymentsService.refundForJob("job-1");

    expect(invoicesService.createCreditNoteForPayment).toHaveBeenCalledWith(
      "pay-1"
    );
  });
});
