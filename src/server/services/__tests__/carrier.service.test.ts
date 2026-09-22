import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => await fn({}) },
}));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: {} }));
vi.mock("@/server/dal/users.dal", () => ({ assignRoleIfMissing: vi.fn() }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));

import { carrierService } from "../carrier.service";
import { carriersDal } from "@/server/dal/carriers.dal";
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
