import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * ============================================================================
 * Client confirmation tokens
 * ============================================================================
 *
 * A capability to record one attestation: "the client agrees this milestone
 * happened". It is mailed and texted to people who have no account here, which
 * is only defensible because the capability grants nothing else - it cannot
 * move a status, capture a payment or close a listing
 * (transport_status_confirmation_spec.md §1, §6).
 *
 * Stateless on purpose. A stored-token table would need issuing, lookup and a
 * cleanup cron to protect something whose worst case is a confirmation
 * recorded against a milestone that already happened, and which the unique
 * index on `shipment_confirmations` already makes unreplayable.
 */

const ALGORITHM = "sha256";

/** Long enough for a client who answers a week late, short enough that last
 *  year's SMS is inert. */
export const CONFIRMATION_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * The two moments goods change hands, and the only two a client is asked to
 * attest. `ASSIGNED` and `IN_TRANSIT` are internal to the carrier and the
 * client witnesses neither, so asking would manufacture a row that stays
 * pending for ever (transport_status_confirmation_spec.md §4).
 *
 * Named once here; every schema and guard derives from it rather than
 * restating the pair.
 */
export const CONFIRMABLE_MILESTONES = ["PICKED_UP", "DELIVERED"] as const;

export type ConfirmableMilestone = (typeof CONFIRMABLE_MILESTONES)[number];

interface TokenPayload {
  /** shipment id */
  s: string;
  /** milestone */
  m: ConfirmableMilestone;
  /** expiry, epoch seconds */
  e: number;
}

export interface ConfirmationTokenClaims {
  shipmentId: string;
  milestone: ConfirmableMilestone;
  expiresAt: Date;
}

/**
 * Unset ⇒ we mint nothing and honour nothing. A deployment that forgot the
 * secret should mail no links rather than mail links it will later refuse, and
 * should refuse every presented token rather than accept every one.
 */
function secret(): string | null {
  return process.env.BETTER_AUTH_SECRET || null;
}

const encode = (value: Buffer | string) =>
  Buffer.from(value).toString("base64url");

function sign(body: string, key: string): string {
  return createHmac(ALGORITHM, key).update(body).digest("base64url");
}

/**
 * Returns null when the secret is unset. Callers must treat that as "send the
 * message without a link", never as "skip the message".
 */
export function mintConfirmationToken(
  shipmentId: string,
  milestone: ConfirmableMilestone,
  ttlSeconds: number = CONFIRMATION_TOKEN_TTL_SECONDS
): string | null {
  const key = secret();
  if (!key) return null;

  const payload: TokenPayload = {
    s: shipmentId,
    m: milestone,
    e: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = encode(JSON.stringify(payload));
  return `${body}.${sign(body, key)}`;
}

/**
 * Null for every failure mode - unset secret, malformed token, wrong
 * signature, unknown milestone, expiry. The caller reports one code for all of
 * them, so a probe learns nothing from which one it hit.
 */
export function verifyConfirmationToken(
  token: string
): ConfirmationTokenClaims | null {
  const key = secret();
  if (!key) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body, key));
  const presented = Buffer.from(signature);
  // timingSafeEqual throws on a length mismatch rather than returning false.
  if (expected.length !== presented.length) return null;
  if (!timingSafeEqual(expected, presented)) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload?.s !== "string" || !payload.s) return null;
  if (!CONFIRMABLE_MILESTONES.includes(payload.m)) return null;
  if (typeof payload.e !== "number") return null;
  if (payload.e * 1000 <= Date.now()) return null;

  return {
    shipmentId: payload.s,
    milestone: payload.m,
    expiresAt: new Date(payload.e * 1000),
  };
}

/** The public landing page the SMS and the email point at. */
export function confirmationUrl(
  shipmentId: string,
  milestone: ConfirmableMilestone
): string | null {
  const token = mintConfirmationToken(shipmentId, milestone);
  if (!token) return null;

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://expeditoo.com";
  return `${base.replace(/\/$/, "")}/confirm/${token}`;
}
