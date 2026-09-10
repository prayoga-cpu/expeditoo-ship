import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { handleError } from "../api-response";
import { FeedbackError } from "@/server/services/feedback.service";

/**
 * Covers docs/specs/feedback_spec.md §3.
 *
 * `handleError` translates only the error classes it names in an explicit
 * `instanceof` chain; anything else becomes a bare INTERNAL_ERROR 500. That is
 * not hypothetical — `PaymentError` was missing from the chain until
 * 2026-08-29, so every payment failure on an accept reached the browser as an
 * untyped 500 and the client's `PAYMENT_METHOD_REQUIRED` branch had never once
 * fired. Nothing but a test like this catches it: types are fine, lint is fine,
 * and the route looks correct.
 */

describe("handleError", () => {
  it("translates a FeedbackError into its own code and status", async () => {
    const res = handleError(new FeedbackError("FORBIDDEN", 403), "test");
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("keeps a 404 a 404", async () => {
    const res = handleError(
      new FeedbackError("FEEDBACK_NOT_FOUND", 404),
      "test"
    );

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("FEEDBACK_NOT_FOUND");
  });

  it("turns a schema failure into a 400 that names the fields", async () => {
    const parsed = z.object({ a: z.string() }).safeParse({});
    expect(parsed.success).toBe(false);

    const res = handleError((parsed as { error: unknown }).error, "test");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
  });

  it("falls back to a 500 for something it has never seen", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = handleError(new Error("who knows"), "test");

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
    spy.mockRestore();
  });
});
