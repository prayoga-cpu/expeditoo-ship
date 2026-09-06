import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Covers docs/specs/invoice_at_payment_spec.md §6 — where a document's number
 * comes from.
 *
 * The harness stands in for exactly one Drizzle chain: the upsert that claims a
 * counter row. It models the counter the way Postgres does — `ON CONFLICT DO
 * UPDATE ... RETURNING` reads and increments in a single statement — so a
 * scheme that computed the number *before* writing it would not pass here
 * either.
 */

const harness = vi.hoisted(() => {
  type Row = Record<string, unknown>;

  const sequencesTable = { series: "series", year: "year", lastValue: "lastValue" };
  const invoicesTable = { id: "invoices" };

  const counters = new Map<string, number>();
  const invoiceRows: Row[] = [];

  /** The one statement, applied atomically, as the database applies it. */
  const claim = (series: string, year: number) => {
    const key = `${series}-${year}`;
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    return next;
  };

  const tx = {
    insert: (table: object) => ({
      values: (values: Row) => {
        if (table === sequencesTable) {
          return {
            onConflictDoUpdate: () => ({
              returning: async () => [
                {
                  lastValue: claim(values.series as string, values.year as number),
                },
              ],
            }),
          };
        }
        return {
          returning: async () => {
            const row = { ...values };
            invoiceRows.push(row);
            return [row];
          },
        };
      },
    }),
  };

  const db = {
    transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    query: { invoices: { findFirst: async () => undefined, findMany: async () => [] } },
  };

  return {
    db,
    sequencesTable,
    invoicesTable,
    counters,
    invoiceRows,
    reset: () => {
      counters.clear();
      invoiceRows.length = 0;
    },
  };
});

vi.mock("@/db", () => ({ db: harness.db }));
vi.mock("@/db/schema/document-sequences", () => ({
  documentSequences: harness.sequencesTable,
}));
vi.mock("@/db/schema/invoices", () => ({ invoices: harness.invoicesTable }));
vi.mock("nanoid", () => ({ nanoid: () => "generated-id" }));

import { invoicesDal } from "../invoices.dal";

const YEAR = new Date().getFullYear();

beforeEach(() => {
  harness.reset();
});

describe("document numbering", () => {
  const create = (over: Record<string, unknown> = {}) =>
    invoicesDal.create({
      paymentId: "pay-1",
      userId: "client-1",
      amount: 18_000,
      currency: "eur",
      ...over,
    } as never);

  it("numbers an invoice in the INV series for the current year", async () => {
    const invoice = await create();

    expect(invoice.invoiceNumber).toBe(`INV-${YEAR}-0001`);
  });

  it("hands out a different number to every document in the series", async () => {
    const first = await create();
    const second = await create();

    // The old scheme derived this from `count(*)` in a statement of its own, so
    // two documents raised in the same second computed the same string and the
    // loser hit the UNIQUE constraint.
    expect(first.invoiceNumber).not.toBe(second.invoiceNumber);
    expect(second.invoiceNumber).toBe(`INV-${YEAR}-0002`);
  });

  it("keeps the invoice series gapless when a document is deleted", async () => {
    await create();
    await create();
    // Purging `pi_mock_` payments cascade-deletes their invoices
    // (docs/TESTING_MOCKS.md §1); a count would then re-issue INV-0002.
    harness.invoiceRows.length = 0;

    const next = await create();

    expect(next.invoiceNumber).toBe(`INV-${YEAR}-0003`);
  });

  it("numbers a credit note in its own series, so the invoices keep no gap", async () => {
    await create();
    const creditNote = await create({ kind: "credit_note", amount: -18_000 });
    const nextInvoice = await create();

    expect(creditNote.invoiceNumber).toBe(`AV-${YEAR}-0001`);
    expect(nextInvoice.invoiceNumber).toBe(`INV-${YEAR}-0002`);
  });
});

describe("create", () => {
  it("honours the status the caller asks for", async () => {
    // It used to write `status: "issued"` *after* the spread, so a caller that
    // passed one type-checked cleanly and was silently overridden.
    const invoice = await invoicesDal.create({
      paymentId: "pay-1",
      userId: "client-1",
      amount: 18_000,
      currency: "eur",
      status: "paid",
    } as never);

    expect(invoice.status).toBe("paid");
  });

  it("still defaults to issued when the caller says nothing", async () => {
    const invoice = await invoicesDal.create({
      paymentId: "pay-1",
      userId: "client-1",
      amount: 18_000,
      currency: "eur",
    } as never);

    expect(invoice.status).toBe("issued");
    expect(invoice.kind).toBe("invoice");
    expect(invoice.issuedAt).toBeInstanceOf(Date);
  });
});
