// @vitest-environment node
// (Under jsdom, a partial mock of `node:crypto` loses `createHash`.)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timingSafeEqual, randomInt } from "node:crypto";

import * as codesDAL from "@/server/dal/verification-codes.dal";
import * as usersDAL from "@/server/dal/users.dal";
import {
  CODE_IDENTIFIER_PREFIX,
  EmailCodeError,
  MAX_CODE_ATTEMPTS,
  codeIdentifier,
  issueVerificationCode,
  verifyEmailCode,
} from "../email-code.service";

/**
 * The emailed access code (email_access_code_spec.md §3). The DAL is an
 * in-memory stand-in for the `verification` table that keeps its contract —
 * replace-by-identifier, newest first, an attempt counted before it is
 * compared, a delete that answers whether it deleted — so what is tested is
 * the service's rules, not drizzle.
 */

type Row = { id: string; identifier: string; value: string; expiresAt: Date; seq: number };

const store = vi.hoisted(() => ({ rows: new Map<string, Row>(), seq: 0 }));

const mocks = vi.hoisted(() => ({
  welcome: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  const spied = {
    ...actual,
    timingSafeEqual: vi.fn(actual.timingSafeEqual),
    randomInt: vi.fn(actual.randomInt),
  };
  return { ...spied, default: spied };
});

vi.mock("@/server/dal/verification-codes.dal", () => ({
  replaceCode: vi.fn(async (identifier: string, row: Omit<Row, "identifier" | "seq">) => {
    for (const [id, existing] of store.rows) {
      if (existing.identifier === identifier) store.rows.delete(id);
    }
    store.rows.set(row.id, { ...row, identifier, seq: ++store.seq });
  }),
  findLatestCode: vi.fn(async (identifier: string) =>
    [...store.rows.values()]
      .filter((row) => row.identifier === identifier)
      .sort((a, b) => b.seq - a.seq)[0]
  ),
  countAttempt: vi.fn(async (id: string) => {
    const row = store.rows.get(id);
    if (!row) return null;
    const value = JSON.parse(row.value) as { attempts: number };
    row.value = JSON.stringify({ ...value, attempts: value.attempts + 1 });
    return row.value;
  }),
  consumeCode: vi.fn(async (id: string) => store.rows.delete(id)),
  purgeExpiredCodes: vi.fn(async () => {}),
}));

vi.mock("@/server/dal/users.dal", () => ({
  getUserByEmail: vi.fn(),
  verifyUserEmail: vi.fn(),
}));

// auth.service (reached through `confirmAddress`) imports these; the welcome's
// own rendering is email.service's business.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/dal/sessions.dal", () => ({}));
vi.mock("@/server/services/email.service", () => ({
  emailService: { sendWelcomeEmail: mocks.welcome },
}));

type UserRow = Awaited<ReturnType<typeof usersDAL.getUserByEmail>>;
const account = (emailVerified: boolean) =>
  ({
    id: "user_1",
    email: "jean@mail.com",
    name: "Jean Dupont",
    origin: "expeditoo",
    emailVerified,
  }) as unknown as UserRow;

const rowFor = (email: string) =>
  [...store.rows.values()].find((row) => row.identifier === codeIdentifier(email));

/** The refusal a call answered with, so its code and tries left can be read. */
async function refusalOf(promise: Promise<unknown>): Promise<EmailCodeError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof EmailCodeError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

/** A code that is not `code`. */
const wrong = (code: string) => (code === "000000" ? "111111" : "000000");

beforeEach(() => {
  store.rows.clear();
  vi.clearAllMocks();
  mocks.welcome.mockResolvedValue(undefined);
  vi.mocked(usersDAL.getUserByEmail).mockResolvedValue(account(false));
});

afterEach(() => vi.useRealTimers());

describe("issueVerificationCode", () => {
  it("answers six digits and stores only their hash", async () => {
    const code = await issueVerificationCode("jean@mail.com");

    expect(code).toMatch(/^\d{6}$/);
    const row = rowFor("jean@mail.com");
    expect(row?.identifier).toBe(`${CODE_IDENTIFIER_PREFIX}jean@mail.com`);
    const stored = JSON.parse(row?.value ?? "{}");
    expect(stored).toEqual({ hash: expect.stringMatching(/^[0-9a-f]{64}$/), attempts: 0 });
    expect(row?.value).not.toContain(code);
  });

  it("keeps a code that starts with zeros six digits long", async () => {
    vi.mocked(randomInt).mockImplementationOnce(() => 42);

    await expect(issueVerificationCode("jean@mail.com")).resolves.toBe("000042");
  });

  it("files the code under the address as Better Auth stores it", async () => {
    await issueVerificationCode("  Jean@Mail.COM ");

    expect(rowFor("jean@mail.com")).toBeDefined();
  });

  it("expires with the link, an hour after it is issued", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));

    await issueVerificationCode("jean@mail.com");

    expect(rowFor("jean@mail.com")?.expiresAt).toEqual(new Date("2026-11-24T11:00:00Z"));
  });

  it("replaces the previous code: only the newest mail works", async () => {
    vi.mocked(randomInt)
      .mockImplementationOnce(() => 123456)
      .mockImplementationOnce(() => 654321);

    await issueVerificationCode("jean@mail.com");
    await issueVerificationCode("jean@mail.com");

    expect(store.rows.size).toBe(1);
    expect((await refusalOf(verifyEmailCode("jean@mail.com", "123456"))).code).toBe(
      "INVALID_CODE"
    );
    await expect(verifyEmailCode("jean@mail.com", "654321")).resolves.toMatchObject({
      newlyVerified: true,
    });
  });

  it("still answers a code when the housekeeping fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(codesDAL.purgeExpiredCodes).mockRejectedValueOnce(new Error("db down"));

    await expect(issueVerificationCode("jean@mail.com")).resolves.toMatch(/^\d{6}$/);
    consoleError.mockRestore();
  });
});

describe("verifyEmailCode — a right code", () => {
  it("verifies the address, welcomes it, and burns the code", async () => {
    const code = await issueVerificationCode("jean@mail.com");

    await expect(verifyEmailCode("jean@mail.com", code)).resolves.toEqual({
      email: "jean@mail.com",
      newlyVerified: true,
    });
    expect(usersDAL.verifyUserEmail).toHaveBeenCalledWith("user_1");
    expect(mocks.welcome).toHaveBeenCalledTimes(1);
    expect(rowFor("jean@mail.com")).toBeUndefined();
    expect((await refusalOf(verifyEmailCode("jean@mail.com", code))).code).toBe(
      "CODE_EXPIRED"
    );
  });

  // Verified by the link first, say: nothing to write, nobody to greet twice.
  it("welcomes nobody a second time", async () => {
    vi.mocked(usersDAL.getUserByEmail).mockResolvedValue(account(true));
    const code = await issueVerificationCode("jean@mail.com");

    await expect(verifyEmailCode("jean@mail.com", code)).resolves.toEqual({
      email: "jean@mail.com",
      newlyVerified: false,
    });
    expect(usersDAL.verifyUserEmail).not.toHaveBeenCalled();
    expect(mocks.welcome).not.toHaveBeenCalled();
  });

  it("does not fail a verification because the welcome could not leave", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.welcome.mockRejectedValue(new Error("Resend is down"));
    const code = await issueVerificationCode("jean@mail.com");

    await expect(verifyEmailCode("jean@mail.com", code)).resolves.toMatchObject({
      newlyVerified: true,
    });
    expect(usersDAL.verifyUserEmail).toHaveBeenCalledWith("user_1");
    consoleError.mockRestore();
  });

  it("matches whatever case the address is typed in", async () => {
    const code = await issueVerificationCode("jean@mail.com");

    await expect(verifyEmailCode(" JEAN@mail.com", code)).resolves.toMatchObject({
      email: "jean@mail.com",
    });
  });

  it("refuses a right code whose account has since gone", async () => {
    const code = await issueVerificationCode("jean@mail.com");
    vi.mocked(usersDAL.getUserByEmail).mockResolvedValue(undefined);

    expect((await refusalOf(verifyEmailCode("jean@mail.com", code))).code).toBe(
      "CODE_EXPIRED"
    );
    expect(usersDAL.verifyUserEmail).not.toHaveBeenCalled();
  });
});

describe("verifyEmailCode — refusals", () => {
  it("counts down the tries left on a wrong code", async () => {
    const code = await issueVerificationCode("jean@mail.com");

    const left: Array<number | undefined> = [];
    for (let i = 1; i < MAX_CODE_ATTEMPTS; i += 1) {
      const refusal = await refusalOf(verifyEmailCode("jean@mail.com", wrong(code)));
      expect(refusal.code).toBe("INVALID_CODE");
      expect(refusal.status).toBe(400);
      left.push(refusal.attemptsLeft);
    }
    expect(left).toEqual([4, 3, 2, 1]);
  });

  it("burns the code on the fifth wrong try", async () => {
    const code = await issueVerificationCode("jean@mail.com");
    for (let i = 1; i < MAX_CODE_ATTEMPTS; i += 1) {
      await refusalOf(verifyEmailCode("jean@mail.com", wrong(code)));
    }

    const fifth = await refusalOf(verifyEmailCode("jean@mail.com", wrong(code)));

    expect(fifth.code).toBe("TOO_MANY_ATTEMPTS");
    expect(fifth.status).toBe(429);
    expect(rowFor("jean@mail.com")).toBeUndefined();
    // The right code is no use now either.
    expect((await refusalOf(verifyEmailCode("jean@mail.com", code))).code).toBe(
      "CODE_EXPIRED"
    );
    expect(usersDAL.verifyUserEmail).not.toHaveBeenCalled();
  });

  it("still takes the right code on the last try", async () => {
    const code = await issueVerificationCode("jean@mail.com");
    for (let i = 1; i < MAX_CODE_ATTEMPTS; i += 1) {
      await refusalOf(verifyEmailCode("jean@mail.com", wrong(code)));
    }

    await expect(verifyEmailCode("jean@mail.com", code)).resolves.toMatchObject({
      newlyVerified: true,
    });
  });

  // The count is taken before the comparison, so a burst of guesses sent at
  // once gets no more comparisons than one sent after another.
  it("compares no more than five guesses, however many arrive at once", async () => {
    const code = await issueVerificationCode("jean@mail.com");

    const refusals = await Promise.all(
      Array.from({ length: 8 }, () => refusalOf(verifyEmailCode("jean@mail.com", wrong(code))))
    );

    expect(vi.mocked(timingSafeEqual)).toHaveBeenCalledTimes(MAX_CODE_ATTEMPTS);
    expect(refusals.filter((r) => r.code === "TOO_MANY_ATTEMPTS").length).toBeGreaterThan(0);
  });

  it("compares hashes in constant time", async () => {
    const code = await issueVerificationCode("jean@mail.com");

    await refusalOf(verifyEmailCode("jean@mail.com", wrong(code)));

    const [stored, candidate] = vi.mocked(timingSafeEqual).mock.calls[0];
    expect(Buffer.isBuffer(stored) && stored.length).toBe(32);
    expect(Buffer.isBuffer(candidate) && candidate.length).toBe(32);
  });

  it("refuses an expired code and clears it away", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    const code = await issueVerificationCode("jean@mail.com");
    vi.setSystemTime(new Date("2026-11-24T11:00:01Z"));

    const refusal = await refusalOf(verifyEmailCode("jean@mail.com", code));

    expect(refusal.code).toBe("CODE_EXPIRED");
    expect(refusal.status).toBe(410);
    expect(rowFor("jean@mail.com")).toBeUndefined();
    expect(usersDAL.verifyUserEmail).not.toHaveBeenCalled();
  });

  // No account enumeration: an address nobody signed up with reads exactly
  // like an account with no live code, and no account is looked up for it.
  it("answers an unknown address the way it answers an address with no code", async () => {
    const unknown = await refusalOf(verifyEmailCode("nobody@mail.com", "123456"));
    const known = await refusalOf(verifyEmailCode("jean@mail.com", "123456"));

    expect(unknown.code).toBe("CODE_EXPIRED");
    expect([unknown.code, unknown.status, unknown.message]).toEqual([
      known.code,
      known.status,
      known.message,
    ]);
    expect(usersDAL.getUserByEmail).not.toHaveBeenCalled();
  });

  it("treats a row it cannot read as no code at all", async () => {
    store.rows.set("broken", {
      id: "broken",
      identifier: codeIdentifier("jean@mail.com"),
      value: "not json",
      expiresAt: new Date(Date.now() + 60_000),
      seq: ++store.seq,
    });

    expect((await refusalOf(verifyEmailCode("jean@mail.com", "123456"))).code).toBe(
      "CODE_EXPIRED"
    );
    expect(store.rows.has("broken")).toBe(false);
  });
});
