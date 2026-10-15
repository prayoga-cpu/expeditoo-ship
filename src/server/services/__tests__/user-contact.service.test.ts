import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn("tx")) },
}));
vi.mock("@/server/dal/user-contact.dal", () => ({ userContactDal: {} }));

import { userContactService, UserContactError } from "../user-contact.service";
import { userContactDal } from "@/server/dal/user-contact.dal";

/**
 * client_feedback_2026_10_spec.md §7b — a person's own phone and a relative's,
 * read and written by the owner, read by staff, by nobody else.
 */

const row = (over: Record<string, unknown> = {}) => ({
  name: "Jean Dupont",
  firstName: null,
  lastName: null,
  alias: null,
  phone: null,
  relativeName: null,
  relativePhone: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(userContactDal, {
    get: vi.fn().mockResolvedValue(row()),
    updateNames: vi.fn(),
    upsertDetails: vi.fn(),
  });
});

async function codeFrom(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    if (error instanceof UserContactError) return error.code;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("userContactService.updateOwn", () => {
  it("writes the names, re-composes `name`, and the phones, in one transaction", async () => {
    await userContactService.updateOwn("user-1", {
      firstName: "Marie",
      lastName: "Curie",
      phone: "+33612345678",
      relativeName: "Pierre Curie",
      relativePhone: "+33698765432",
    });

    expect(userContactDal.updateNames).toHaveBeenCalledWith(
      "user-1",
      { firstName: "Marie", lastName: "Curie", name: "Marie Curie" },
      "tx"
    );
    expect(userContactDal.upsertDetails).toHaveBeenCalledWith(
      "user-1",
      { phone: "+33612345678", relativeName: "Pierre Curie", relativePhone: "+33698765432" },
      "tx"
    );
  });

  it("clears a field sent empty and leaves an absent one alone", async () => {
    await userContactService.updateOwn("user-1", { relativePhone: "", alias: "" });

    expect(userContactDal.upsertDetails).toHaveBeenCalledWith(
      "user-1",
      { relativePhone: null },
      "tx"
    );
    expect(userContactDal.updateNames).toHaveBeenCalledWith("user-1", { alias: null }, "tx");
  });

  it("does not rewrite `name` from one part alone", async () => {
    await userContactService.updateOwn("user-1", { firstName: "Marie" });

    expect(userContactDal.updateNames).toHaveBeenCalledWith(
      "user-1",
      { firstName: "Marie" },
      "tx"
    );
  });

  it("refuses a phone that is not one, and an empty name", async () => {
    await expect(
      userContactService.updateOwn("user-1", { relativePhone: "12" })
    ).rejects.toThrow();
    await expect(userContactService.updateOwn("user-1", { lastName: " " })).rejects.toThrow();
    expect(userContactDal.upsertDetails).not.toHaveBeenCalled();
  });

  it("refuses a field it does not know", async () => {
    await expect(
      userContactService.updateOwn("user-1", { isVerified: true })
    ).rejects.toThrow();
  });
});

describe("userContactService.getForStaff", () => {
  it("answers an admin or an operator", async () => {
    vi.mocked(userContactDal.get).mockResolvedValue(row({ relativePhone: "+33698765432" }) as never);

    const view = await userContactService.getForStaff(
      { userId: "op", isAdmin: false, isOperator: true },
      "user-1"
    );
    expect(view.relativePhone).toBe("+33698765432");
  });

  it("refuses anyone else", async () => {
    expect(
      await codeFrom(() =>
        userContactService.getForStaff(
          { userId: "carrier", isAdmin: false, isOperator: false },
          "user-1"
        )
      )
    ).toBe("FORBIDDEN");
    expect(userContactDal.get).not.toHaveBeenCalled();
  });

  it("says when the account is gone", async () => {
    vi.mocked(userContactDal.get).mockResolvedValue(undefined as never);
    expect(
      await codeFrom(() =>
        userContactService.getForStaff({ userId: "a", isAdmin: true, isOperator: false }, "x")
      )
    ).toBe("USER_NOT_FOUND");
  });
});
