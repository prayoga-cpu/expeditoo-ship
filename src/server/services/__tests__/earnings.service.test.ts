import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  earningsService,
  earningsQuerySchema,
  MAX_STATEMENT_ROWS,
} from "../earnings.service";
import { earningsDal } from "@/server/dal/earnings.dal";
import { carrierService } from "@/server/services/carrier.service";
import { COMMISSION_RATE } from "@/server/services/payments.service";

// Covers docs/specs/billing_documents_spec.md §7.

vi.mock("@/server/dal/earnings.dal", () => ({
  earningsDal: {
    listForCarrier: vi.fn(),
    summariseForCarrier: vi.fn(),
  },
}));

vi.mock("@/server/services/carrier.service", () => ({
  carrierService: { requireOwnCarrier: vi.fn() },
  CarrierError: class extends Error {},
}));

const row = (overrides: Record<string, unknown> = {}) => ({
  shipmentId: "s1",
  listingId: "l1",
  listingTitle: "Canapé Châtellerault → Montrouge",
  origin: "expedion",
  externalRef: "1670768",
  deliveredAt: new Date("2026-08-24"),
  pickupCity: "Châtellerault",
  dropoffCity: "Montrouge",
  pickupAddress: "1 rue A",
  dropoffAddress: "2 rue B",
  priceCents: 3000,
  grossCents: 3000,
  commissionCents: 3000,
  capturedAt: new Date("2026-08-24"),
  paymentStatus: "captured",
  netCents: 0,
  payoutStatus: "scheduled",
  paidAt: null,
  ...overrides,
});

const summary = (overrides: Record<string, number> = {}) => ({
  deliveries: 1,
  grossCents: 3000,
  commissionCents: 3000,
  netCents: 0,
  paidCents: 0,
  pendingCents: 0,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(carrierService.requireOwnCarrier).mockResolvedValue({
    id: "carrier-1",
    companyName: "Transports Durand",
    siret: "73282932000074",
  } as never);
});

describe("earningsQuerySchema", () => {
  it("rejects a period that ends before it starts", () => {
    expect(() =>
      earningsQuerySchema.parse({ from: "2026-09-10", to: "2026-09-01" })
    ).toThrow(/INVALID_PERIOD/);
  });

  it("accepts an open-ended period", () => {
    expect(() => earningsQuerySchema.parse({})).not.toThrow();
  });
});

describe("earningsService.getForCarrier", () => {
  it("requires a carrier record", async () => {
    vi.mocked(carrierService.requireOwnCarrier).mockRejectedValue(
      new Error("CARRIER_NOT_FOUND")
    );

    await expect(
      earningsService.getForCarrier("u1", earningsQuerySchema.parse({}))
    ).rejects.toThrow("CARRIER_NOT_FOUND");
  });

  it("reports gross, commission and net as three separate figures", async () => {
    vi.mocked(earningsDal.listForCarrier).mockResolvedValue([row()] as never);
    vi.mocked(earningsDal.summariseForCarrier).mockResolvedValue(
      summary() as never
    );

    const result = await earningsService.getForCarrier(
      "u1",
      earningsQuerySchema.parse({})
    );

    expect(result.items[0]).toMatchObject({
      grossCents: 3000,
      commissionCents: 3000,
      netCents: 0,
    });
    expect(result.summary.grossCents).toBe(3000);
  });

  it("reports a delivery with no payment row as zeros rather than dropping it", async () => {
    vi.mocked(earningsDal.listForCarrier).mockResolvedValue([
      row({
        grossCents: null,
        commissionCents: null,
        netCents: null,
        payoutStatus: null,
        paymentStatus: null,
      }),
    ] as never);
    vi.mocked(earningsDal.summariseForCarrier).mockResolvedValue(
      summary({ grossCents: 0, commissionCents: 0 }) as never
    );

    const result = await earningsService.getForCarrier(
      "u1",
      earningsQuerySchema.parse({})
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      grossCents: 0,
      commissionCents: 0,
      netCents: 0,
      payoutStatus: null,
      // The awarded price survives even when no payment was recorded.
      priceCents: 3000,
    });
  });

  it("falls back to the shipment id when the job carries no external ref", async () => {
    vi.mocked(earningsDal.listForCarrier).mockResolvedValue([
      row({ externalRef: null }),
    ] as never);
    vi.mocked(earningsDal.summariseForCarrier).mockResolvedValue(
      summary() as never
    );

    const result = await earningsService.getForCarrier(
      "u1",
      earningsQuerySchema.parse({})
    );

    expect(result.items[0].reference).toBe("s1");
  });

  it("does not claim the platform retains everything, now the split is back", async () => {
    vi.mocked(earningsDal.listForCarrier).mockResolvedValue([] as never);
    vi.mocked(earningsDal.summariseForCarrier).mockResolvedValue(
      summary({ deliveries: 0, grossCents: 0, commissionCents: 0 }) as never
    );

    const result = await earningsService.getForCarrier(
      "u1",
      earningsQuerySchema.parse({})
    );

    // This flag existed for the brief window when COMMISSION_RATE was 1.0 and
    // a carrier's net was always €0.00 — the screen said so rather than letting
    // that read as a defect. The rate is back to 0.1 and the remaining 90% is
    // genuinely owed, so the flag must now be false or the earnings screen
    // would tell a driver they are owed nothing while a withdrawal is waiting
    // for them. It is derived from the constant rather than restated, so it
    // follows the rate wherever it goes next.
    expect(result.commissionRetainsAll).toBe(COMMISSION_RATE >= 1);
    expect(result.commissionRetainsAll).toBe(false);
  });
});

describe("earningsService.getStatementRows", () => {
  it("refuses a period wider than the row cap", async () => {
    vi.mocked(earningsDal.summariseForCarrier).mockResolvedValue(
      summary({ deliveries: MAX_STATEMENT_ROWS + 1 }) as never
    );

    await expect(
      earningsService.getStatementRows("u1", {})
    ).rejects.toMatchObject({ code: "STATEMENT_TOO_LARGE", status: 400 });
  });

  it("returns the carrier identity alongside the rows", async () => {
    vi.mocked(earningsDal.summariseForCarrier).mockResolvedValue(
      summary() as never
    );
    vi.mocked(earningsDal.listForCarrier).mockResolvedValue([row()] as never);

    const result = await earningsService.getStatementRows("u1", {});

    expect(result.carrier.companyName).toBe("Transports Durand");
    expect(result.items).toHaveLength(1);
  });

  it("renders an empty period rather than failing", async () => {
    vi.mocked(earningsDal.summariseForCarrier).mockResolvedValue(
      summary({ deliveries: 0, grossCents: 0, commissionCents: 0 }) as never
    );
    vi.mocked(earningsDal.listForCarrier).mockResolvedValue([] as never);

    const result = await earningsService.getStatementRows("u1", {});

    expect(result.items).toEqual([]);
    expect(result.summary.deliveries).toBe(0);
  });
});
