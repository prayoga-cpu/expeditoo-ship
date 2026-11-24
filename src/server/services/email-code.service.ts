import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

import * as codesDAL from "@/server/dal/verification-codes.dal";
import * as usersDAL from "@/server/dal/users.dal";
import {
  EMAIL_CODE_LENGTH,
  EMAIL_VERIFICATION_TTL_SECONDS,
} from "@/lib/email-code";

/**
 * The six-digit access code a verification mail carries beside its link
 * (email_access_code_spec.md).
 *
 * A link is a capability for the browser that opens it, and that is where it
 * broke for people: opened on a phone while the sign-up tab waited on a
 * laptop, or eaten by a mail scanner. A code can be read on one device and
 * typed on another. It proves exactly what the link proves — that the person
 * reads this inbox — and grants exactly that: the address becomes verified.
 * It never opens a session; the person still signs in with their password.
 *
 * Not Better Auth's email-otp plugin: that opens public endpoints including a
 * passwordless sign-up that skips the name fields, and its verify path skips
 * `afterEmailVerification`, so nobody would be welcomed.
 */

export const CODE_IDENTIFIER_PREFIX = "email-verification-code:";

/** Wrong codes allowed before the code is burnt and a new one must be asked for. */
export const MAX_CODE_ATTEMPTS = 5;

export type EmailCodeErrorCode =
  | "CODE_EXPIRED"
  | "TOO_MANY_ATTEMPTS"
  | "INVALID_CODE";

export class EmailCodeError extends Error {
  constructor(
    readonly code: EmailCodeErrorCode,
    readonly status: number,
    message: string,
    /** Tries left on this code. Set on `INVALID_CODE` only. */
    readonly attemptsLeft?: number
  ) {
    super(message);
    this.name = "EmailCodeError";
  }
}

const expired = () =>
  new EmailCodeError(
    "CODE_EXPIRED",
    410,
    "This code has expired or is no longer valid. Ask for a new one."
  );

const tooManyAttempts = () =>
  new EmailCodeError(
    "TOO_MANY_ATTEMPTS",
    429,
    "Too many wrong codes. Ask for a new one."
  );

const invalidCode = (attemptsLeft: number) =>
  new EmailCodeError(
    "INVALID_CODE",
    400,
    `Wrong code. ${attemptsLeft} attempt(s) left.`,
    attemptsLeft
  );

interface StoredCode {
  hash: string;
  attempts: number;
}

const normalise = (email: string) => email.trim().toLowerCase();

/** The `verification.identifier` a code is filed under — one per address. */
export const codeIdentifier = (email: string) =>
  `${CODE_IDENTIFIER_PREFIX}${normalise(email)}`;

/** Salted by the identifier, so one code's hash says nothing about another address's. */
function hashCode(identifier: string, code: string): string {
  return createHash("sha256").update(`${identifier}:${code}`).digest("hex");
}

/** Constant-time: how much of a guess matched never shows in the response time. */
function sameHash(storedHex: string, candidateHex: string): boolean {
  const stored = Buffer.from(storedHex, "hex");
  const candidate = Buffer.from(candidateHex, "hex");
  // `timingSafeEqual` throws on unequal lengths; a malformed stored hash is
  // simply not a match.
  if (stored.length !== candidate.length) return false;
  return timingSafeEqual(stored, candidate);
}

function parseStored(value: string | null): StoredCode | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredCode>;
    if (typeof parsed.hash !== "string" || typeof parsed.attempts !== "number") {
      return null;
    }
    return { hash: parsed.hash, attempts: parsed.attempts };
  } catch {
    return null;
  }
}

/**
 * A fresh code for `email`, replacing any earlier one: the newest mail is the
 * one that works. Only the hash is stored. Answers the code, for the mail.
 */
export async function issueVerificationCode(email: string): Promise<string> {
  const identifier = codeIdentifier(email);
  const code = String(randomInt(0, 10 ** EMAIL_CODE_LENGTH)).padStart(
    EMAIL_CODE_LENGTH,
    "0"
  );
  const stored: StoredCode = { hash: hashCode(identifier, code), attempts: 0 };

  await codesDAL.replaceCode(identifier, {
    id: randomUUID(),
    value: JSON.stringify(stored),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000),
  });

  // Housekeeping for sign-ups that never came back; never worth failing for.
  await codesDAL
    .purgeExpiredCodes(CODE_IDENTIFIER_PREFIX)
    .catch((error) =>
      console.error("[Email code] Purging expired codes failed:", error)
    );

  return code;
}

export interface EmailCodeVerified {
  email: string;
  /** False when the address was already verified (by the link, say). */
  newlyVerified: boolean;
}

/**
 * Checks a typed code and, when it is right, verifies the address.
 *
 * No live code — never issued, used, replaced, expired, or an address with no
 * account at all — answers `CODE_EXPIRED`, the same for all of them, and the
 * account is not looked up until a code has matched: nothing here tells a
 * stranger whether an address has an account.
 *
 * @throws EmailCodeError `CODE_EXPIRED`, `TOO_MANY_ATTEMPTS` or `INVALID_CODE`
 */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<EmailCodeVerified> {
  const identifier = codeIdentifier(email);
  const row = await codesDAL.findLatestCode(identifier);
  if (!row) throw expired();

  if (row.expiresAt.getTime() <= Date.now() || !parseStored(row.value)) {
    await codesDAL.consumeCode(row.id);
    throw expired();
  }

  const counted = parseStored(await codesDAL.countAttempt(row.id));
  if (!counted) throw expired();
  if (counted.attempts > MAX_CODE_ATTEMPTS) {
    await codesDAL.consumeCode(row.id);
    throw tooManyAttempts();
  }

  if (!sameHash(counted.hash, hashCode(identifier, code))) {
    return refuseWrongCode(row.id, counted.attempts);
  }

  // Exactly one of two concurrent right answers gets past this line.
  if (!(await codesDAL.consumeCode(row.id))) throw expired();

  return confirm(normalise(email));
}

/** A wrong code: tries left, or — on the last one — the code is burnt. */
async function refuseWrongCode(id: string, attempts: number): Promise<never> {
  const left = MAX_CODE_ATTEMPTS - attempts;
  if (left > 0) throw invalidCode(left);

  await codesDAL.consumeCode(id);
  throw tooManyAttempts();
}

/**
 * The address is proven: verify it, and welcome it if this is the first time.
 *
 * `auth.service` is imported lazily because it imports this module to issue
 * the code a mail carries; a static import both ways is a cycle.
 */
async function confirm(address: string): Promise<EmailCodeVerified> {
  const user = await usersDAL.getUserByEmail(address);
  // The account went while its code was live: nothing left to verify.
  if (!user) throw expired();

  const { confirmAddress } = await import("@/server/services/auth.service");
  const newlyVerified = await confirmAddress(user);

  return { email: address, newlyVerified };
}
