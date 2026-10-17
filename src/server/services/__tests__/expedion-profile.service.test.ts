import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/dal/addresses.dal", () => ({ addressesDal: {} }));
vi.mock("@/server/services/user-contact.service", () => ({
  userContactService: { getOwn: vi.fn(), updateOwn: vi.fn() },
}));
vi.mock("@/server/services/addresses.service", () => ({
  addressesService: { create: vi.fn(), update: vi.fn() },
}));

import {
  expedionProfileService,
  ExpedionProfileError,
} from "../expedion-profile.service";
import type { ExpedionCaller } from "@/lib/expedion-auth";
import { addressesDal } from "@/server/dal/addresses.dal";
import { userContactService } from "@/server/services/user-contact.service";
import { addressesService } from "@/server/services/addresses.service";

/**
 * launch_readiness_spec.md §C — the profile the Expedion app kept in Airtable's
 * USERS table, now read and written here.
 */

const session: ExpedionCaller = {
  userId: "user-1",
  isAdmin: false,
  email: "camille@example.fr",
  emailVerified: true,
  via: "session",
};

const HOME = {
  id: "addr-1",
  userId: "user-1",
  label: "home",
  street: "12 rue Oberkampf",
  details: "",
  zip: "75011",
  city: "Paris",
  country: "France",
  isDefault: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userContactService.getOwn).mockResolvedValue({
    name: "Camille Martin",
    firstName: "Camille",
    lastName: "Martin",
    alias: null,
    phone: "+33612345678",
    relativeName: null,
    relativePhone: null,
  });
  Object.assign(addressesDal, { getDefaultByUserId: vi.fn().mockResolvedValue(HOME) });
});

async function codeFrom(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    if (error instanceof ExpedionProfileError) return error.code;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("expedionProfileService.get", () => {
  it("answers with the names, phone and default address, an empty second line as none", async () => {
    expect(await expedionProfileService.get(session)).toEqual({
      email: "camille@example.fr",
      firstName: "Camille",
      lastName: "Martin",
      phone: "+33612345678",
      address: {
        line1: "12 rue Oberkampf",
        line2: null,
        zip: "75011",
        city: "Paris",
        country: "France",
      },
    });
  });

  it("answers a null address when there is none", async () => {
    vi.mocked(addressesDal.getDefaultByUserId).mockResolvedValue(undefined);
    expect((await expedionProfileService.get(session)).address).toBeNull();
  });

  it.each(["firebase", "client-key", "admin-key"] as const)(
    "refuses a %s caller, who may have no account here",
    async (via) => {
      expect(await codeFrom(() => expedionProfileService.get({ ...session, via }))).toBe(
        "PROFILE_NEEDS_ACCOUNT"
      );
      expect(
        await codeFrom(() => expedionProfileService.update({ ...session, via }, {}))
      ).toBe("PROFILE_NEEDS_ACCOUNT");
      expect(userContactService.getOwn).not.toHaveBeenCalled();
    }
  );
});

describe("expedionProfileService.update", () => {
  it("stores a phone typed the French way as E.164", async () => {
    await expedionProfileService.update(session, { phone: "06 12 34 56 78" });

    expect(userContactService.updateOwn).toHaveBeenCalledWith("user-1", {
      phone: "+33612345678",
    });
    expect(addressesService.update).not.toHaveBeenCalled();
  });

  it("clears the phone on an empty string", async () => {
    await expedionProfileService.update(session, { phone: "" });
    expect(userContactService.updateOwn).toHaveBeenCalledWith("user-1", { phone: "" });
  });

  it("updates the default address in place", async () => {
    await expedionProfileService.update(session, {
      address: { line1: "3 quai Voltaire", line2: "Bât B", zip: "75007", city: "Paris", country: "France" },
    });

    expect(addressesService.update).toHaveBeenCalledWith("addr-1", "user-1", {
      street: "3 quai Voltaire",
      details: "Bât B",
      zip: "75007",
      city: "Paris",
      country: "France",
    });
    expect(addressesService.create).not.toHaveBeenCalled();
    expect(userContactService.updateOwn).not.toHaveBeenCalled();
  });

  it("creates a default « home » address when there is none", async () => {
    vi.mocked(addressesDal.getDefaultByUserId).mockResolvedValue(undefined);

    await expedionProfileService.update(session, {
      address: { line1: "3 quai Voltaire", zip: "75007", city: "Paris", country: "France" },
    });

    expect(addressesService.create).toHaveBeenCalledWith("user-1", {
      street: "3 quai Voltaire",
      details: "",
      zip: "75007",
      city: "Paris",
      country: "France",
      label: "home",
      isDefault: true,
    });
  });

  it("writes nothing when any part is invalid", async () => {
    await expect(
      expedionProfileService.update(session, {
        firstName: "Camille",
        phone: "12",
        address: { line1: "x", zip: "75007", city: "Paris", country: "France" },
      })
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      expedionProfileService.update(session, {
        address: { line1: "", zip: "75007", city: "Paris", country: "France" },
      })
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      expedionProfileService.update(session, { email: "other@example.fr" })
    ).rejects.toBeInstanceOf(ZodError);

    expect(userContactService.updateOwn).not.toHaveBeenCalled();
    expect(addressesService.update).not.toHaveBeenCalled();
    expect(addressesService.create).not.toHaveBeenCalled();
  });
});
