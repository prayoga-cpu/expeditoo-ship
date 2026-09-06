import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "../route";
import { auth } from "@/lib/auth";
import { invoicesService, InvoiceError } from "@/server/services/invoices.service";
import { resetRateLimits } from "@/lib/rate-limit";

/**
 * Covers docs/specs/invoice_at_payment_spec.md §8 — the on-demand re-send.
 *
 * The service is mocked; it has its own suite. What is exercised here is what
 * the route adds: the session, the rate limit, the masked answer, and error
 * translation — the last of which is why the service throws typed errors at all
 * (an untyped refusal reached `handleError` as a bare 500).
 */

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

vi.mock("@/server/services/invoices.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/services/invoices.service")
  >("@/server/services/invoices.service");
  return {
    ...actual,
    invoicesService: {
      getOwnedInvoice: vi.fn(),
      sendDocumentEmail: vi.fn(),
    },
  };
});

vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }));

const getSessionMock = vi.mocked(auth.api.getSession);
const getOwnedMock = vi.mocked(invoicesService.getOwnedInvoice);
const sendMock = vi.mocked(invoicesService.sendDocumentEmail);

const req = () =>
  new NextRequest("http://localhost/api/user/invoices/inv-1/email", {
    method: "POST",
  });

const params = Promise.resolve({ id: "inv-1" });

const body = async (response: Response) =>
  (await response.json()) as {
    success: boolean;
    data?: { sentTo: string };
    error?: { code: string };
  };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  getSessionMock.mockResolvedValue({ user: { id: "client-1" } } as never);
  getOwnedMock.mockResolvedValue({ id: "inv-1" } as never);
  sendMock.mockResolvedValue({ sentTo: "camille@example.com" } as never);
});

describe("POST /api/user/invoices/[id]/email", () => {
  it("sends the document and answers a masked address", async () => {
    const response = await POST(req(), { params });

    expect(response.status).toBe(200);
    expect((await body(response)).data).toEqual({ sentTo: "c***@example.com" });
    expect(sendMock).toHaveBeenCalledWith("inv-1");
  });

  it("refuses without a session", async () => {
    getSessionMock.mockResolvedValue(null as never);

    const response = await POST(req(), { params });

    expect(response.status).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("answers 403, not 500, for somebody else's document", async () => {
    getOwnedMock.mockRejectedValue(new InvoiceError("INVOICE_NOT_YOURS", 403));

    const response = await POST(req(), { params });

    expect(response.status).toBe(403);
    expect((await body(response)).error?.code).toBe("INVOICE_NOT_YOURS");
  });

  it("answers 404 for a document that does not exist", async () => {
    getOwnedMock.mockRejectedValue(new InvoiceError("INVOICE_NOT_FOUND", 404));

    expect((await POST(req(), { params })).status).toBe(404);
  });

  it("stops after five sends of the same document in an hour", async () => {
    for (let i = 0; i < 5; i += 1) await POST(req(), { params });

    const sixth = await POST(req(), { params });

    expect(sixth.status).toBe(429);
    expect((await body(sixth)).error?.code).toBe("RATE_LIMITED");
    expect(sendMock).toHaveBeenCalledTimes(5);
  });

  it("reports a refused send as 502 rather than a bare failure", async () => {
    sendMock.mockRejectedValue(new InvoiceError("INVOICE_EMAIL_FAILED", 502));

    const response = await POST(req(), { params });

    expect(response.status).toBe(502);
    expect((await body(response)).error?.code).toBe("INVOICE_EMAIL_FAILED");
  });
});
