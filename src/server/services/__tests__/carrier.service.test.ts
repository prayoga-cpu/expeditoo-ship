import { describe, it, expect } from "vitest";
import { applicationGaps } from "../carrier.service";
import {
  isValidSiret,
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
  // Real-format SIRETs that satisfy the Luhn check.
  it.each(["73282932000074", "40483304800022"])("accepts %s", (siret) => {
    expect(isValidSiret(siret)).toBe(true);
  });

  it("rejects a number whose check digit is wrong", () => {
    expect(isValidSiret("73282932000075")).toBe(false);
  });

  it("rejects anything that is not exactly 14 digits", () => {
    expect(isValidSiret("7328293200007")).toBe(false);
    expect(isValidSiret("732829320000745")).toBe(false);
    expect(isValidSiret("7328293200007A")).toBe(false);
    expect(isValidSiret("")).toBe(false);
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
// Submission gate — carrier_kyc_spec.md §3
// ========================================

const doc = (kind: string, expiresAt: Date | null = null) => ({ kind, expiresAt });

const completeCarrier = (over: Record<string, unknown> = {}) =>
  ({
    ibanLast4: "2606",
    bicLast4: "PPXX",
    documents: [
      doc("cni_recto"),
      doc("cni_verso"),
      doc("driving_licence"),
      doc("kbis"),
      doc("insurance_certificate"),
      doc("rib"),
    ],
    vehicles: [{ type: "van", maxWeightKg: 1200 }],
    ...over,
  }) as Parameters<typeof applicationGaps>[0];

describe("applicationGaps", () => {
  it("finds nothing wrong with a complete application", () => {
    expect(applicationGaps(completeCarrier())).toEqual([]);
  });

  // The spec is explicit that an applicant sees the whole list at once rather
  // than discovering one gap per submission.
  it("reports every gap in one pass", () => {
    const gaps = applicationGaps(
      completeCarrier({
        ibanLast4: null,
        bicLast4: null,
        documents: [doc("cni_recto")],
        vehicles: [],
      })
    );

    expect(gaps).toEqual(
      expect.arrayContaining([
        "document:cni_verso",
        "document:driving_licence",
        "document:kbis",
        "document:insurance_certificate",
        "document:rib",
        "banking:iban",
        "banking:bic",
        "vehicle:at_least_one",
      ])
    );
    expect(gaps.length).toBeGreaterThan(5);
  });

  it("requires a transport licence once a vehicle is 7.5t or heavier", () => {
    const gaps = applicationGaps(
      completeCarrier({ vehicles: [{ type: "truck_19t", maxWeightKg: 19_000 }] })
    );

    expect(gaps).toContain("document:transport_licence");
  });

  it("does not demand a transport licence for a van", () => {
    expect(applicationGaps(completeCarrier())).not.toContain(
      "document:transport_licence"
    );
  });

  it("accepts a heavy fleet once the licence is supplied", () => {
    const gaps = applicationGaps(
      completeCarrier({
        vehicles: [{ type: "semi_trailer", maxWeightKg: 40_000 }],
        documents: [
          doc("cni_recto"),
          doc("cni_verso"),
          doc("driving_licence"),
          doc("kbis"),
          doc("insurance_certificate"),
          doc("rib"),
          doc("transport_licence"),
        ],
      })
    );

    expect(gaps).toEqual([]);
  });

  it("flags a document that has already expired", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const gaps = applicationGaps(
      completeCarrier({
        documents: [
          doc("cni_recto"),
          doc("cni_verso"),
          doc("driving_licence", yesterday),
          doc("kbis"),
          doc("insurance_certificate"),
          doc("rib"),
        ],
      })
    );

    expect(gaps).toContain("expired:driving_licence");
  });

  it("accepts a document that expires in the future", () => {
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const gaps = applicationGaps(
      completeCarrier({
        documents: [
          doc("cni_recto"),
          doc("cni_verso"),
          doc("driving_licence", nextYear),
          doc("kbis"),
          doc("insurance_certificate"),
          doc("rib"),
        ],
      })
    );

    expect(gaps).toEqual([]);
  });
});
