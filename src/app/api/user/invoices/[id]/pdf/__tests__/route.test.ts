import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "../route";
import { auth } from "@/lib/auth";
import { invoicesService, InvoiceError } from "@/server/services/invoices.service";

/**
 * Covers docs/specs/invoice_at_payment_spec.md §8 — the download now answers the
 * standard envelope on refusal.
 *
 * It used to call `invoicesDal` directly, compare `userId` inline and answer
 * `{ error: "Unauthorized" }`, so the download and the e-mail button in the same
 * row failed in two different shapes and only one carried a code the screen
 * could read.
 */

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

vi.mock("@/server/services/invoices.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/services/invoices.service")
  >("@/server/services/invoices.service");
  return { ...actual, invoicesService: { getOwnedInvoice: vi.fn() } };
});

vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }));

const getSessionMock = vi.mocked(auth.api.getSession);
const getOwnedMock = vi.mocked(invoicesService.getOwnedInvoice);

const req = () =>
  new NextRequest("http://localhost/api/user/invoices/inv-1/pdf");

const params = Promise.resolve({ id: "inv-1" });

const INVOICE = {
  id: "inv-1",
  invoiceNumber: "INV-2026-0001",
  amount: 18_000,
  currency: "eur",
  status: "paid",
  kind: "invoice",
  issuedAt: new Date("2026-09-01T10:00:00Z"),
  createdAt: new Date("2026-09-01T10:00:00Z"),
  paidAt: new Date("2026-09-01T10:00:00Z"),
  dueAt: null,
  billingName: "Camille Roux",
  billingEmail: "camille@example.com",
  payment: { source: "stripe", stripePaymentIntentId: "pi_real_1", listing: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ user: { id: "client-1" } } as never);
  getOwnedMock.mockResolvedValue(INVOICE as never);
});

describe("GET /api/user/invoices/[id]/pdf", () => {
  it("answers the document, named after it", async () => {
    const response = await GET(req(), { params });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(
      'filename="INV-2026-0001.pdf"'
    );
  });

  it("refuses without a session, in the standard envelope", async () => {
    getSessionMock.mockResolvedValue(null as never);

    const response = await GET(req(), { params });
    const body = (await response.json()) as { error?: { code: string } };

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe("UNAUTHENTICATED");
  });

  it("answers a coded 403 for somebody else's document", async () => {
    getOwnedMock.mockRejectedValue(new InvoiceError("INVOICE_NOT_YOURS", 403));

    const response = await GET(req(), { params });
    const body = (await response.json()) as { error?: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("INVOICE_NOT_YOURS");
  });

  it("answers a coded 404 for a document that does not exist", async () => {
    getOwnedMock.mockRejectedValue(new InvoiceError("INVOICE_NOT_FOUND", 404));

    const response = await GET(req(), { params });
    const body = (await response.json()) as { error?: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error?.code).toBe("INVOICE_NOT_FOUND");
  });
});
