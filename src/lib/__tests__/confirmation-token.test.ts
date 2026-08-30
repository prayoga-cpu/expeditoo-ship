import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  confirmationUrl,
  mintConfirmationToken,
  verifyConfirmationToken,
  CONFIRMABLE_MILESTONES,
} from "../confirmation-token";

// Covers docs/specs/transport_status_confirmation_spec.md §12.

const SECRET = "test-secret-for-confirmation-tokens";

describe("confirmation tokens", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = SECRET;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a shipment id and milestone", () => {
    const token = mintConfirmationToken("ship-1", "DELIVERED");
    expect(token).toBeTruthy();

    const claims = verifyConfirmationToken(token!);
    expect(claims).toMatchObject({
      shipmentId: "ship-1",
      milestone: "DELIVERED",
    });
  });

  it("covers exactly the two milestones the spec names", () => {
    expect([...CONFIRMABLE_MILESTONES]).toEqual(["PICKED_UP", "DELIVERED"]);
  });

  it("rejects a tampered payload", () => {
    const token = mintConfirmationToken("ship-1", "DELIVERED")!;
    const [, signature] = token.split(".");

    const forged = Buffer.from(
      JSON.stringify({
        s: "someone-elses-shipment",
        m: "DELIVERED",
        e: Math.floor(Date.now() / 1000) + 60,
      })
    ).toString("base64url");

    expect(verifyConfirmationToken(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = mintConfirmationToken("ship-1", "PICKED_UP")!;
    const [body, signature] = token.split(".");
    const flipped = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");

    expect(verifyConfirmationToken(`${body}.${flipped}`)).toBeNull();
  });

  it("rejects a truncated token", () => {
    const token = mintConfirmationToken("ship-1", "PICKED_UP")!;

    expect(verifyConfirmationToken(token.split(".")[0])).toBeNull();
    expect(verifyConfirmationToken("")).toBeNull();
    // A length mismatch must return null rather than throwing out of
    // timingSafeEqual, which is what it does on unequal buffers.
    expect(() => verifyConfirmationToken("abc.def")).not.toThrow();
    expect(verifyConfirmationToken("abc.def")).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = mintConfirmationToken("ship-1", "DELIVERED")!;
    process.env.BETTER_AUTH_SECRET = "a-different-secret";

    expect(verifyConfirmationToken(token)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T10:00:00Z"));
    const token = mintConfirmationToken("ship-1", "DELIVERED", 60)!;

    vi.setSystemTime(new Date("2026-08-29T10:00:59Z"));
    expect(verifyConfirmationToken(token)).not.toBeNull();

    vi.setSystemTime(new Date("2026-08-29T10:01:01Z"));
    expect(verifyConfirmationToken(token)).toBeNull();
  });

  it("mints nothing and honours nothing when the secret is unset", () => {
    const token = mintConfirmationToken("ship-1", "DELIVERED")!;

    delete process.env.BETTER_AUTH_SECRET;

    // Fails closed both ways: no link is minted, and a previously valid one is
    // refused rather than a misconfigured deployment honouring everything.
    expect(mintConfirmationToken("ship-1", "DELIVERED")).toBeNull();
    expect(confirmationUrl("ship-1", "DELIVERED")).toBeNull();
    expect(verifyConfirmationToken(token)).toBeNull();
  });

  it("builds a link on the public app origin", () => {
    const url = confirmationUrl("ship-1", "PICKED_UP")!;

    expect(url.startsWith("https://app.example.com/confirm/")).toBe(true);
    const token = url.split("/confirm/")[1];
    expect(verifyConfirmationToken(token)).toMatchObject({
      shipmentId: "ship-1",
      milestone: "PICKED_UP",
    });
  });
});
