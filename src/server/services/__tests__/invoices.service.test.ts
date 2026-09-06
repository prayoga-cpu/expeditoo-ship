import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Covers docs/specs/invoice_at_payment_spec.md §1, §3, §5 and §7 — what the
 * invoicing service raises, what it refuses to raise, and what it says about it.
 *
 * The suite this replaces asserted `invoicesDal.create` had "been called" and
 * fed it `{ amount: 1000 }` where the service reads `amountCents`, so the row
 * it claimed to check was written with an undefined amount and nothing noticed.
 */

vi.mock("@/server/dal/invoices.dal", () => ({
  invoicesDal: {
    getByPaymentId: vi.fn(),
    getCreditNoteFor: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    getByUserId: vi.fn(),
    updatePdfUrl: vi.fn(),
  },
}));
vi.mock("@/server/dal/payments.dal", () => ({
  paymentsDal: { getById: vi.fn(), getByUserId: vi.fn() },
}));
vi.mock("@/server/dal/addresses.dal", () => ({
  addressesDal: { getDefaultByUserId: vi.fn() },
}));
vi.mock("@/server/dal/users.dal", () => ({ getUserById: vi.fn() }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/server/services/invoice-email.service", () => ({
  invoiceDocumentEmail: vi.fn().mockResolvedValue(true),
}));

import { invoicesService, InvoiceError } from "../invoices.service";
import { invoicesDal } from "@/server/dal/invoices.dal";
import { paymentsDal } from "@/server/dal/payments.dal";
import { addressesDal } from "@/server/dal/addresses.dal";
import { getUserById } from "@/server/dal/users.dal";
import { notificationsService } from "@/server/services/notifications.service";
import { invoiceDocumentEmail } from "@/server/services/invoice-email.service";

// ========================================
// Fixtures
// ========================================

const payment = (over: Record<string, unknown> = {}) => ({
  id: "pay-1",
  userId: "client-1",
  amountCents: 18_000,
  currency: "eur",
  status: "captured",
  source: "stripe",
  capturedAt: new Date("2026-09-01T10:00:00Z"),
  listing: { title: "Palette Lyon → Paris" },
  ...over,
});

const account = (over: Record<string, unknown> = {}) => ({
  id: "client-1",
  name: "Camille Roux",
  email: "camille@example.com",
  preferences: {},
  ...over,
});

const created = (over: Record<string, unknown> = {}) => ({
  id: "inv-1",
  invoiceNumber: "INV-2026-0001",
  userId: "client-1",
  paymentId: "pay-1",
  amount: 18_000,
  currency: "eur",
  kind: "invoice",
  ...over,
});

/** Runs `fn` and returns the InvoiceError code it threw. */
async function codeFrom(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof InvoiceError) return error.code;
    throw error;
  }
  throw new Error("expected the call to throw");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(paymentsDal.getById).mockResolvedValue(payment() as never);
  vi.mocked(invoicesDal.getByPaymentId).mockResolvedValue(undefined as never);
  vi.mocked(invoicesDal.getCreditNoteFor).mockResolvedValue(undefined as never);
  vi.mocked(invoicesDal.create).mockResolvedValue(created() as never);
  vi.mocked(invoicesDal.getById).mockResolvedValue(
    created({ user: { email: "camille@example.com", name: "Camille Roux" } }) as never
  );
  vi.mocked(getUserById).mockResolvedValue(account() as never);
  vi.mocked(addressesDal.getDefaultByUserId).mockResolvedValue(undefined as never);
  // `clearAllMocks` forgets calls, not implementations, so a case that made the
  // mail reject would otherwise poison every case after it.
  vi.mocked(invoiceDocumentEmail).mockResolvedValue(true as never);
});

// ========================================
// Raising the document
// ========================================

describe("createFromPayment", () => {
  it("bills the amount that was taken, as a settled document", async () => {
    await invoicesService.createFromPayment("pay-1");

    expect(invoicesDal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pay-1",
        userId: "client-1",
        amount: 18_000,
        currency: "eur",
        // The money is already taken; "issued" would describe a receivable.
        status: "paid",
        paidAt: new Date("2026-09-01T10:00:00Z"),
      })
    );
  });

  it("freezes the billed party and the prestation onto the row", async () => {
    vi.mocked(addressesDal.getDefaultByUserId).mockResolvedValue({
      street: "12 rue de la Paix",
      zip: "75002",
      city: "Paris",
      country: "France",
    } as never);

    await invoicesService.createFromPayment("pay-1");

    expect(invoicesDal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        billingName: "Camille Roux",
        billingEmail: "camille@example.com",
        billingAddress: "12 rue de la Paix, 75002 Paris, France",
        lineDescription: "Transport de marchandises — Palette Lyon → Paris",
      })
    );
  });

  it("prints a prestation even when the job is gone", async () => {
    vi.mocked(paymentsDal.getById).mockResolvedValue(
      payment({ listing: null }) as never
    );

    await invoicesService.createFromPayment("pay-1");

    expect(invoicesDal.create).toHaveBeenCalledWith(
      expect.objectContaining({ lineDescription: "Transport de marchandises" })
    );
  });

  it("raises exactly one document per payment", async () => {
    vi.mocked(invoicesDal.getByPaymentId).mockResolvedValue(created() as never);

    const result = await invoicesService.createFromPayment("pay-1");

    expect(result).toMatchObject({ id: "inv-1" });
    expect(invoicesDal.create).not.toHaveBeenCalled();
  });

  it("documents nothing for money Expedion took", async () => {
    // That client was invoiced in the app that debited them, into that app's
    // Stripe account. §3 — this is the majority lane.
    vi.mocked(paymentsDal.getById).mockResolvedValue(
      payment({ source: "expedion", stripePaymentIntentId: null }) as never
    );

    expect(await invoicesService.createFromPayment("pay-1")).toBeNull();
    expect(invoicesDal.create).not.toHaveBeenCalled();
  });

  it("documents nothing for money that never arrived", async () => {
    vi.mocked(paymentsDal.getById).mockResolvedValue(
      payment({ status: "failed" }) as never
    );

    expect(await invoicesService.createFromPayment("pay-1")).toBeNull();
    expect(invoicesDal.create).not.toHaveBeenCalled();
  });

  it("documents nothing for money already given back", async () => {
    vi.mocked(paymentsDal.getById).mockResolvedValue(
      payment({ status: "refunded" }) as never
    );

    expect(await invoicesService.createFromPayment("pay-1")).toBeNull();
  });

  it("refuses a payment that does not exist", async () => {
    vi.mocked(paymentsDal.getById).mockResolvedValue(undefined as never);

    expect(await codeFrom(() => invoicesService.createFromPayment("nope"))).toBe(
      "PAYMENT_NOT_FOUND"
    );
  });

  it("tells the client, in the app and in their inbox", async () => {
    await invoicesService.createFromPayment("pay-1");

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "client-1", type: "payment" })
    );
    expect(invoiceDocumentEmail).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceNumber: "INV-2026-0001" }),
      "camille@example.com"
    );
  });

  it("skips the mail for an account that asked not to be mailed", async () => {
    vi.mocked(getUserById).mockResolvedValue(
      account({
        preferences: { notifications: { email: { invoiceReady: false } } },
      }) as never
    );

    await invoicesService.createFromPayment("pay-1");

    expect(invoicesDal.create).toHaveBeenCalled();
    expect(invoiceDocumentEmail).not.toHaveBeenCalled();
  });

  it("still raises the document when the mail fails", async () => {
    vi.mocked(invoiceDocumentEmail).mockRejectedValue(new Error("resend down"));

    const result = await invoicesService.createFromPayment("pay-1");

    expect(result).toMatchObject({ id: "inv-1" });
  });
});

// ========================================
// Correcting it
// ========================================

describe("createCreditNoteForPayment", () => {
  beforeEach(() => {
    vi.mocked(invoicesDal.getByPaymentId).mockResolvedValue(
      created({
        amount: 18_000,
        billingName: "Camille Roux",
        lineDescription: "Transport de marchandises — Palette Lyon → Paris",
      }) as never
    );
    vi.mocked(invoicesDal.create).mockResolvedValue(
      created({ id: "cn-1", invoiceNumber: "AV-2026-0001", kind: "credit_note" }) as never
    );
  });

  it("raises a negative document pointing at what it corrects", async () => {
    await invoicesService.createCreditNoteForPayment("pay-1");

    expect(invoicesDal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "credit_note",
        relatedInvoiceId: "inv-1",
        // The number too, so the document can name what it corrects on its own
        // face rather than through a join.
        relatedInvoiceNumber: "INV-2026-0001",
        amount: -18_000,
        // The billed party is carried over, not re-read: an avoir corrects a
        // document, so it must address whoever that document addressed.
        billingName: "Camille Roux",
        lineDescription: "Transport de marchandises — Palette Lyon → Paris",
      })
    );
  });

  it("corrects a document once, however many times the refund is retried", async () => {
    vi.mocked(invoicesDal.getCreditNoteFor).mockResolvedValue({
      id: "cn-1",
    } as never);

    const result = await invoicesService.createCreditNoteForPayment("pay-1");

    expect(result).toMatchObject({ id: "cn-1" });
    expect(invoicesDal.create).not.toHaveBeenCalled();
  });

  it("corrects nothing when nothing was ever documented", async () => {
    // The escalated lane, and every charge that failed before it settled.
    vi.mocked(invoicesDal.getByPaymentId).mockResolvedValue(undefined as never);

    expect(await invoicesService.createCreditNoteForPayment("pay-1")).toBeNull();
    expect(invoicesDal.create).not.toHaveBeenCalled();
  });
});

// ========================================
// Reading and re-sending
// ========================================

describe("getOwnedInvoice", () => {
  it("answers a typed 404 for a document that does not exist", async () => {
    vi.mocked(invoicesDal.getById).mockResolvedValue(undefined as never);

    expect(
      await codeFrom(() => invoicesService.getOwnedInvoice("inv-1", "client-1"))
    ).toBe("INVOICE_NOT_FOUND");
  });

  it("answers a typed 403 for somebody else's document", async () => {
    // Untyped, this reached `handleError` as a bare 500 and the screen could
    // never tell the two apart.
    const code = await codeFrom(() =>
      invoicesService.getOwnedInvoice("inv-1", "someone-else")
    );

    expect(code).toBe("INVOICE_NOT_YOURS");
  });

  it("hands the row to its owner", async () => {
    const invoice = await invoicesService.getOwnedInvoice("inv-1", "client-1");

    expect(invoice).toMatchObject({ id: "inv-1" });
  });
});

describe("sendDocumentEmail", () => {
  it("sends to the address frozen on the document", async () => {
    vi.mocked(invoicesDal.getById).mockResolvedValue(
      created({
        billingEmail: "frozen@example.com",
        user: { email: "changed@example.com" },
      }) as never
    );

    const result = await invoicesService.sendDocumentEmail("inv-1");

    expect(result).toEqual({ sentTo: "frozen@example.com" });
  });

  it("falls back to the account address on a document issued before the snapshot", async () => {
    vi.mocked(invoicesDal.getById).mockResolvedValue(
      created({ billingEmail: null, user: { email: "camille@example.com" } }) as never
    );

    const result = await invoicesService.sendDocumentEmail("inv-1");

    expect(result).toEqual({ sentTo: "camille@example.com" });
  });

  it("reports a refused send as a typed failure, not a 500", async () => {
    vi.mocked(invoiceDocumentEmail).mockRejectedValue(new Error("resend down"));

    expect(await codeFrom(() => invoicesService.sendDocumentEmail("inv-1"))).toBe(
      "INVOICE_EMAIL_FAILED"
    );
  });
});
