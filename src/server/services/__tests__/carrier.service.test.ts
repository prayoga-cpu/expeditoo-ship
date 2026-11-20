import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => await fn({}) },
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: {} }));
vi.mock("@/server/dal/offers.dal", () => ({ offersDal: {} }));
vi.mock("@/server/dal/shipments.dal", () => ({ shipmentsDal: {} }));
vi.mock("@/server/dal/users.dal", () => ({
  assignRoleIfMissing: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  verifyUserEmail: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      requestPasswordReset: vi.fn(),
    },
  },
}));

import { carrierService } from "../carrier.service";
import { carriersDal } from "@/server/dal/carriers.dal";
import * as usersDal from "@/server/dal/users.dal";
import { auth } from "@/lib/auth";
import {
  isValidSiret,
  normalizeSiret,
  isValidIban,
  isValidBic,
  isValidPlate,
  isValidFrenchPhone,
  last4,
} from "@/lib/french-identifiers";

// ========================================
// Identifier checksums — carrier_kyc_spec.md §3
// ========================================

describe("isValidSiret", () => {
  // Format only, no checksum — carrier_kyc_spec.md §3: a real registry lookup
  // is the admin reviewer's job, and a Luhn check rejected well-formed SIRETs
  // typed for testing along with genuine typos.
  it.each(["73282932000074", "40483304800022", "12345678901234"])(
    "accepts %s",
    (siret) => {
      expect(isValidSiret(siret)).toBe(true);
    },
  );

  it("rejects anything that is not exactly 14 digits", () => {
    expect(isValidSiret("7328293200007")).toBe(false);
    expect(isValidSiret("732829320000745")).toBe(false);
    expect(isValidSiret("7328293200007A")).toBe(false);
    expect(isValidSiret("")).toBe(false);
  });

  it("accepts the grouping spaces a SIRET is conventionally printed with", () => {
    expect(isValidSiret("732 829 320 00074")).toBe(true);
    expect(isValidSiret(" 73282932000074 ")).toBe(true);
  });
});

describe("normalizeSiret", () => {
  it("strips grouping spaces", () => {
    expect(normalizeSiret("732 829 320 00074")).toBe("73282932000074");
  });
});

describe("isValidIban", () => {
  it("accepts a well-formed French IBAN", () => {
    expect(isValidIban("FR1420041010050500013M02606")).toBe(true);
  });

  it("ignores spacing, as printed on a RIB", () => {
    expect(isValidIban("FR14 2004 1010 0505 0001 3M02 606")).toBe(true);
  });

  it("rejects a single transposed character", () => {
    expect(isValidIban("FR1420041010050500013M02607")).toBe(false);
  });

  it("rejects a French IBAN of the wrong length", () => {
    expect(isValidIban("FR142004101005050001")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isValidIban("")).toBe(false);
    expect(isValidIban("not-an-iban")).toBe(false);
  });
});

describe("isValidBic", () => {
  it("accepts both 8 and 11 character forms", () => {
    expect(isValidBic("BNPAFRPP")).toBe(true);
    expect(isValidBic("BNPAFRPPXXX")).toBe(true);
  });

  it("rejects the wrong length or shape", () => {
    expect(isValidBic("BNPAFR")).toBe(false);
    expect(isValidBic("BNPAFRPPXX")).toBe(false);
    expect(isValidBic("1234FRPP")).toBe(false);
  });
});

describe("isValidPlate", () => {
  it("accepts the post-2009 French format", () => {
    expect(isValidPlate("AB-123-CD")).toBe(true);
  });

  it("rejects the old format and unseparated input", () => {
    expect(isValidPlate("1234 AB 56")).toBe(false);
    expect(isValidPlate("AB123CD")).toBe(false);
  });
});

describe("isValidFrenchPhone", () => {
  it.each(["0612345678", "+33612345678", "06 12 34 56 78", "01.23.45.67.89"])(
    "accepts %s",
    (phone) => expect(isValidFrenchPhone(phone)).toBe(true)
  );

  it("rejects a number starting 0 0 or of the wrong length", () => {
    expect(isValidFrenchPhone("0012345678")).toBe(false);
    expect(isValidFrenchPhone("061234567")).toBe(false);
  });
});

describe("last4", () => {
  it("keeps only the final four characters of an IBAN", () => {
    expect(last4("FR14 2004 1010 0505 0001 3M02 606")).toBe("2606");
  });
});

// ========================================
// submitApplication — carrier_kyc_spec.md §3
//
// Documents, banking and a vehicle are no longer a submission gate: an
// applicant with only the profile fields on file (already required by
// `upsertCarrierSchema`) can submit, and an admin decides whether that thin
// file is good enough to approve. See docs/specs/carrier_kyc_spec.md §3/§6.
// ========================================

describe("submitApplication", () => {
  const draftCarrier = (over: Record<string, unknown> = {}) => ({
    id: "carrier-1",
    userId: "user-1",
    status: "draft" as const,
    ibanLast4: null,
    bicLast4: null,
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits with no documents, banking or vehicle on file", async () => {
    Object.assign(carriersDal, {
      getByUserId: vi.fn().mockResolvedValue(draftCarrier()),
      update: vi.fn(async (_id: string, data: Record<string, unknown>) => ({
        ...draftCarrier(),
        ...data,
      })),
    });

    const result = await carrierService.submitApplication("user-1");

    expect(result.status).toBe("submitted");
    expect(carriersDal.update).toHaveBeenCalledWith("carrier-1", {
      status: "submitted",
    });
  });

  it("refuses a second submission", async () => {
    Object.assign(carriersDal, {
      getByUserId: vi.fn().mockResolvedValue(draftCarrier({ status: "submitted" })),
      update: vi.fn(),
    });

    await expect(
      carrierService.submitApplication("user-1")
    ).rejects.toMatchObject({ code: "ALREADY_SUBMITTED" });
  });

  it("refuses a suspended carrier", async () => {
    Object.assign(carriersDal, {
      getByUserId: vi.fn().mockResolvedValue(draftCarrier({ status: "suspended" })),
      update: vi.fn(),
    });

    await expect(
      carrierService.submitApplication("user-1")
    ).rejects.toMatchObject({ code: "CARRIER_SUSPENDED" });
  });
});

// ========================================
// approve — carrier_kyc_spec.md §6, edge case 8
// ========================================

describe("approve", () => {
  const submittedCarrier = (over: Record<string, unknown> = {}) => ({
    id: "carrier-1",
    userId: "user-1",
    status: "submitted" as const,
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(carriersDal, {
      setAllDocumentsAccepted: vi.fn().mockResolvedValue(undefined),
      upsertDriverLink: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("approves an application with no documents, banking or vehicle", async () => {
    Object.assign(carriersDal, {
      getById: vi.fn().mockResolvedValue(submittedCarrier()),
      update: vi.fn(async (_id: string, data: Record<string, unknown>) => ({
        ...submittedCarrier(),
        ...data,
      })),
    });

    const result = await carrierService.approve("admin-1", "carrier-1");

    expect(result.status).toBe("approved");
    expect(carriersDal.setAllDocumentsAccepted).toHaveBeenCalled();
  });
});

// ========================================
// createInHouseDriver — driver_types_spec.md §4
// ========================================

describe("createInHouseDriver", () => {
  const signUpEmailMock = vi.mocked(auth.api.signUpEmail);
  const requestPasswordResetMock = vi.mocked(auth.api.requestPasswordReset);
  const getUserByEmailMock = vi.mocked(usersDal.getUserByEmail);
  const verifyUserEmailMock = vi.mocked(usersDal.verifyUserEmail);
  const deleteUserMock = vi.mocked(usersDal.deleteUser);
  const assignRoleMock = vi.mocked(usersDal.assignRoleIfMissing);

  const admin = { userId: "admin-1", isAdmin: true, isOperator: false };
  const operator = { userId: "op-1", isAdmin: false, isOperator: true };

  const input = {
    mode: "invite" as const,
    name: "Jane Driver",
    email: "jane@example.com",
    contactPhone: "0612345678",
    addressLine: "12 rue Exemple",
    city: "Lyon",
    postalCode: "69000",
    vehicle: { type: "van" as const, maxWeightKg: 1200, plateNumber: "ab-123-cd" },
  };

  const registered = { ...input, mode: "existing" as const };

  const existingAccount = (roles: string[]) => ({
    id: "user-existing",
    name: "Existing Name",
    email: input.email,
    roles: roles.map((role) => ({ role })),
  });

  const grantedRoles = () => assignRoleMock.mock.calls.map((call) => call[1]);

  beforeEach(() => {
    vi.clearAllMocks();

    getUserByEmailMock.mockResolvedValue(undefined);
    verifyUserEmailMock.mockResolvedValue(undefined as never);
    deleteUserMock.mockResolvedValue(undefined);
    signUpEmailMock.mockResolvedValue({
      token: null,
      user: { id: "user-new", email: input.email, name: input.name },
    } as never);
    requestPasswordResetMock.mockResolvedValue({ status: true } as never);

    Object.assign(carriersDal, {
      getBySiret: vi.fn().mockResolvedValue(undefined),
      getByUserId: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(async (data: Record<string, unknown>) => ({
        ...data,
        id: "carrier-1",
      })),
      createVehicle: vi.fn().mockResolvedValue({ id: "vehicle-1" }),
      upsertDriverLink: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("creates an account and writes an approved in-house file, a vehicle and the driver role", async () => {
    const result = await carrierService.createInHouseDriver(admin, input);

    expect(signUpEmailMock).toHaveBeenCalledWith({
      body: expect.objectContaining({ name: input.name, email: input.email }),
    });
    expect(verifyUserEmailMock).toHaveBeenCalledWith("user-new");
    expect(carriersDal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-new",
        kind: "private",
        companyName: "Expeditop",
        siret: null,
        status: "approved",
        approvedBy: "admin-1",
      }),
      expect.anything()
    );
    expect(carriersDal.createVehicle).toHaveBeenCalledWith(
      expect.objectContaining({
        carrierId: "carrier-1",
        type: "van",
        plateNumber: "AB-123-CD",
      }),
      expect.anything()
    );
    // The in-house driver is a `driver` — not a carrier, and no longer marked `shipper`.
    expect(grantedRoles()).toEqual(["driver"]);
    expect(carriersDal.upsertDriverLink).toHaveBeenCalled();
    // The invitation: a set-password link whose mail says why it arrived.
    expect(requestPasswordResetMock).toHaveBeenCalledWith({
      body: { email: input.email, redirectTo: "/reset-password?invite=driver" },
    });
    expect(result).toEqual({
      carrierId: "carrier-1",
      userId: "user-new",
      name: input.name,
      email: input.email,
      accountCreated: true,
    });
  });

  it("makes every write inside one transaction", async () => {
    await carrierService.createInHouseDriver(admin, input);

    const tx = vi.mocked(carriersDal.create).mock.calls[0][1];
    expect(tx).toBeDefined();
    expect(vi.mocked(carriersDal.createVehicle).mock.calls[0][1]).toBe(tx);
    for (const call of assignRoleMock.mock.calls) expect(call[3]).toBe(tx);
  });

  it("lets an operator onboard too", async () => {
    await carrierService.createInHouseDriver(operator, input);

    expect(carriersDal.create).toHaveBeenCalledWith(
      expect.objectContaining({ approvedBy: "op-1" }),
      expect.anything()
    );
  });

  it("refuses anyone who is neither admin nor operator", async () => {
    await expect(
      carrierService.createInHouseDriver(
        { userId: "u-1", isAdmin: false, isOperator: false },
        input
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN_ROLE", status: 403 });

    expect(getUserByEmailMock).not.toHaveBeenCalled();
    expect(carriersDal.create).not.toHaveBeenCalled();
  });

  it("converts an existing account without creating or emailing one", async () => {
    getUserByEmailMock.mockResolvedValue(existingAccount(["shipper"]) as never);

    const result = await carrierService.createInHouseDriver(admin, registered);

    expect(signUpEmailMock).not.toHaveBeenCalled();
    expect(verifyUserEmailMock).not.toHaveBeenCalled();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
    expect(carriersDal.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-existing" }),
      expect.anything()
    );
    expect(result).toMatchObject({
      userId: "user-existing",
      name: "Existing Name",
      accountCreated: false,
    });
  });

  it("refuses an account that already drives", async () => {
    getUserByEmailMock.mockResolvedValue(
      existingAccount(["carrier", "driver"]) as never
    );

    await expect(
      carrierService.createInHouseDriver(admin, registered)
    ).rejects.toMatchObject({ code: "ALREADY_DRIVER", status: 409 });

    expect(carriersDal.create).not.toHaveBeenCalled();
  });

  it("refuses an account that already has an application on file", async () => {
    getUserByEmailMock.mockResolvedValue(existingAccount(["shipper"]) as never);
    Object.assign(carriersDal, {
      getByUserId: vi.fn().mockResolvedValue({ id: "carrier-draft" }),
    });

    await expect(
      carrierService.createInHouseDriver(admin, registered)
    ).rejects.toMatchObject({ code: "CARRIER_PROFILE_EXISTS", status: 409 });

    expect(carriersDal.create).not.toHaveBeenCalled();
  });

  it("refuses « registered » for an email with no account, creating nothing", async () => {
    await expect(
      carrierService.createInHouseDriver(admin, registered)
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND", status: 404 });

    expect(signUpEmailMock).not.toHaveBeenCalled();
    expect(carriersDal.create).not.toHaveBeenCalled();
  });

  it("refuses an invitation to an email that already has an account", async () => {
    getUserByEmailMock.mockResolvedValue(existingAccount(["shipper"]) as never);

    await expect(
      carrierService.createInHouseDriver(admin, input)
    ).rejects.toMatchObject({ code: "ACCOUNT_EXISTS", status: 409 });

    expect(signUpEmailMock).not.toHaveBeenCalled();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it("deletes an account it just created when the writes fail, and sends no email", async () => {
    Object.assign(carriersDal, {
      createVehicle: vi.fn().mockRejectedValue(new Error("db down")),
    });

    await expect(
      carrierService.createInHouseDriver(admin, input)
    ).rejects.toThrow("db down");

    expect(deleteUserMock).toHaveBeenCalledWith("user-new");
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it("never deletes a pre-existing account when the writes fail", async () => {
    getUserByEmailMock.mockResolvedValue(existingAccount(["shipper"]) as never);
    Object.assign(carriersDal, {
      createVehicle: vi.fn().mockRejectedValue(new Error("db down")),
    });

    await expect(
      carrierService.createInHouseDriver(admin, registered)
    ).rejects.toThrow("db down");

    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("still succeeds when the set-password email cannot be sent", async () => {
    requestPasswordResetMock.mockRejectedValue(new Error("smtp down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await carrierService.createInHouseDriver(admin, input);

    expect(result.accountCreated).toBe(true);
    expect(deleteUserMock).not.toHaveBeenCalled();
    quiet.mockRestore();
  });
});

// ========================================
// Two kinds of driver — driver_types_spec.md
// ========================================

describe("two kinds of driver", () => {
  const assignRoleMock = vi.mocked(usersDal.assignRoleIfMissing);
  const getUserByIdMock = vi.mocked(usersDal.getUserById);
  const granted = () => assignRoleMock.mock.calls.map((call) => call[1]);

  const file = (over: Record<string, unknown> = {}) => ({
    id: "carrier-1",
    userId: "user-1",
    kind: "professional",
    status: "submitted",
    siret: "73282932000074",
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getUserByIdMock.mockResolvedValue({ id: "user-1", name: "Jean Masson" } as never);
    Object.assign(carriersDal, {
      getById: vi.fn(),
      getByUserId: vi.fn().mockResolvedValue(undefined),
      getBySiret: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(async (data: Record<string, unknown>) => ({ id: "carrier-new", ...data })),
      update: vi.fn(async (_id: string, data: Record<string, unknown>) => ({ ...file(), ...data })),
      setAllDocumentsAccepted: vi.fn().mockResolvedValue(undefined),
      upsertDriverLink: vi.fn().mockResolvedValue(undefined),
      createVehicle: vi.fn().mockResolvedValue({ id: "vehicle-1" }),
    });
  });

  describe("approval grants the role the kind earns", () => {
    it("gives an outside carrier the carrier role and no other", async () => {
      Object.assign(carriersDal, { getById: vi.fn().mockResolvedValue(file()) });

      await carrierService.approve("admin-1", "carrier-1");

      expect(granted()).toEqual(["carrier"]);
      expect(carriersDal.upsertDriverLink).toHaveBeenCalled();
    });

    it("gives an in-house driver the driver role and no other", async () => {
      Object.assign(carriersDal, {
        getById: vi.fn().mockResolvedValue(file({ kind: "private", siret: null })),
      });

      await carrierService.approve("admin-1", "carrier-1");

      expect(granted()).toEqual(["driver"]);
    });
  });

  describe("upsertApplication", () => {
    const inHouse = {
      kind: "private" as const,
      contactPhone: "0612345678",
      addressLine: "12 rue Exemple",
      city: "Lyon",
      postalCode: "69000",
    };

    it("stores an in-house file with Expeditop as the company and no SIRET", async () => {
      await carrierService.upsertApplication("user-1", inHouse);

      expect(carriersDal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          kind: "private",
          companyName: "Expeditop",
          siret: null,
        })
      );
      // No SIRET to collide on.
      expect(carriersDal.getBySiret).not.toHaveBeenCalled();
    });

    it("refuses to change the kind of an approved file", async () => {
      Object.assign(carriersDal, {
        getByUserId: vi.fn().mockResolvedValue(file({ status: "approved" })),
      });

      await expect(
        carrierService.upsertApplication("user-1", inHouse)
      ).rejects.toMatchObject({ code: "KIND_LOCKED", status: 409 });
    });

    it("lets a draft switch kind", async () => {
      Object.assign(carriersDal, {
        getByUserId: vi.fn().mockResolvedValue(file({ status: "draft" })),
      });

      await carrierService.upsertApplication("user-1", inHouse);

      expect(carriersDal.update).toHaveBeenCalledWith(
        "carrier-1",
        expect.objectContaining({ kind: "private", siret: null, status: "draft" })
      );
    });
  });

  describe("grantRole — « Gérer le rôle »", () => {
    it("creates an approved in-house file for someone with none", async () => {
      await carrierService.grantRole("admin-1", "user-1", "driver");

      expect(carriersDal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          kind: "private",
          companyName: "Expeditop",
          status: "approved",
          approvedBy: "admin-1",
        }),
        expect.anything()
      );
      expect(granted()).toEqual(["driver"]);
    });

    it("creates an approved carrier file named after the account", async () => {
      await carrierService.grantRole("admin-1", "user-1", "carrier");

      expect(carriersDal.create).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "professional", companyName: "Jean Masson", status: "approved" }),
        expect.anything()
      );
      expect(granted()).toEqual(["carrier"]);
    });

    it("approves a pending application, setting its kind to the role picked", async () => {
      Object.assign(carriersDal, {
        getByUserId: vi.fn().mockResolvedValue(file({ status: "submitted" })),
      });

      await carrierService.grantRole("admin-1", "user-1", "driver");

      expect(carriersDal.create).not.toHaveBeenCalled();
      expect(carriersDal.update).toHaveBeenCalledWith(
        "carrier-1",
        expect.objectContaining({ kind: "private", status: "approved" }),
        expect.anything()
      );
      expect(granted()).toEqual(["driver"]);
    });

    it("only adds the role to an already approved file", async () => {
      Object.assign(carriersDal, {
        getByUserId: vi.fn().mockResolvedValue(file({ status: "approved" })),
      });

      await carrierService.grantRole("admin-1", "user-1", "driver");

      expect(carriersDal.create).not.toHaveBeenCalled();
      expect(carriersDal.update).not.toHaveBeenCalled();
      expect(granted()).toEqual(["driver"]);
    });

    it("refuses a suspended file — reinstate it first", async () => {
      Object.assign(carriersDal, {
        getByUserId: vi.fn().mockResolvedValue(file({ status: "suspended" })),
      });

      await expect(
        carrierService.grantRole("admin-1", "user-1", "carrier")
      ).rejects.toMatchObject({ code: "CARRIER_SUSPENDED", status: 409 });
      expect(granted()).toEqual([]);
    });
  });

  describe("completing a file on the applicant's behalf", () => {
    const admin = { userId: "admin-1", isAdmin: true, isOperator: false };
    const details = {
      kind: "private" as const,
      contactPhone: "0612345678",
      addressLine: "12 rue Exemple",
      city: "Lyon",
      postalCode: "69000",
    };

    it("updates a submitted file, which the applicant themselves can no longer edit", async () => {
      Object.assign(carriersDal, {
        getById: vi.fn().mockResolvedValue(file({ kind: "private", status: "submitted" })),
      });

      await carrierService.adminUpdateApplication(admin, "carrier-1", details);

      expect(carriersDal.update).toHaveBeenCalledWith(
        "carrier-1",
        expect.objectContaining({ contactPhone: "0612345678", companyName: "Expeditop" })
      );
    });

    it("refuses anyone who is neither admin nor operator", async () => {
      await expect(
        carrierService.adminUpdateApplication(
          { userId: "u", isAdmin: false, isOperator: false },
          "carrier-1",
          details
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN_ROLE", status: 403 });
    });

    it("refuses another carrier's SIRET", async () => {
      Object.assign(carriersDal, {
        getById: vi.fn().mockResolvedValue(file()),
        getBySiret: vi.fn().mockResolvedValue({ id: "carrier-other" }),
      });

      await expect(
        carrierService.adminUpdateApplication(admin, "carrier-1", {
          kind: "professional",
          companyName: "Jane Transport",
          siret: "73282932000074",
          contactPhone: "0612345678",
          addressLine: "12 rue Exemple",
          city: "Lyon",
          postalCode: "69000",
        })
      ).rejects.toMatchObject({ code: "SIRET_ALREADY_REGISTERED", status: 409 });
    });

    it("refuses to change the kind of an approved file", async () => {
      Object.assign(carriersDal, {
        getById: vi.fn().mockResolvedValue(file({ status: "approved" })),
      });

      await expect(
        carrierService.adminUpdateApplication(admin, "carrier-1", details)
      ).rejects.toMatchObject({ code: "KIND_LOCKED", status: 409 });
    });

    it("adds a vehicle to the file", async () => {
      Object.assign(carriersDal, { getById: vi.fn().mockResolvedValue(file()) });

      await carrierService.adminAddVehicle(admin, "carrier-1", {
        type: "van",
        maxWeightKg: 1200,
        plateNumber: "ab-123-cd",
        features: [],
      });

      expect(carriersDal.createVehicle).toHaveBeenCalledWith(
        expect.objectContaining({ carrierId: "carrier-1", plateNumber: "AB-123-CD" })
      );
    });
  });
});
