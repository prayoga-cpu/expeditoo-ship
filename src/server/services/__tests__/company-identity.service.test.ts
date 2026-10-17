import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/dal/company-identity.dal", () => ({ companyIdentityDal: {} }));
vi.mock("@/server/dal/users.dal", () => ({ userHasRole: vi.fn() }));

import {
  companyIdentityService,
  CompanyIdentityError,
} from "../company-identity.service";
import { companyIdentityDal } from "@/server/dal/company-identity.dal";
import { userHasRole } from "@/server/dal/users.dal";

/**
 * launch_readiness_spec.md §A — the company identity an admin types once, which
 * decides whether a payment document is a facture and fills the mentions
 * légales.
 */

const ENV_KEYS = [
  "INVOICE_ISSUER_NAME",
  "INVOICE_ISSUER_LEGAL_FORM",
  "INVOICE_ISSUER_ADDRESS",
  "INVOICE_ISSUER_CAPITAL",
  "INVOICE_ISSUER_SIRET",
  "INVOICE_ISSUER_RCS",
  "INVOICE_ISSUER_VAT_NUMBER",
  "INVOICE_ISSUER_EMAIL",
  "INVOICE_VAT_RATE",
];
const saved: Record<string, string | undefined> = {};

const COMPLETE = {
  legalName: "Atout Global Services",
  legalForm: "SAS",
  capital: "1 000 €",
  address: "1bis rue Pierre et Marie Curie, 92140 Clamart",
  siret: "12345678900012",
  rcs: "RCS Nanterre 123 456 789",
  vatNumber: null,
  vatRate: "0",
  billingEmail: null,
  publicationDirector: "Jean Dupont, Président",
  host: "Vercel Inc.",
};

const row = (over: Record<string, unknown> = {}) => ({
  id: "default",
  ...Object.fromEntries(Object.keys(COMPLETE).map((k) => [k, null])),
  updatedBy: null,
  createdAt: new Date("2026-10-17T08:00:00Z"),
  updatedAt: new Date("2026-10-17T08:00:00Z"),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  vi.mocked(userHasRole).mockImplementation(async (_id, role) => role === "admin");
  Object.assign(companyIdentityDal, {
    get: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn(async (fields: Record<string, unknown>) => row(fields)),
  });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

async function codeFrom(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    if (error instanceof CompanyIdentityError) return error.code;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("companyIdentityService — permissions", () => {
  it("refuses anyone who is neither admin nor finance, before reading", async () => {
    vi.mocked(userHasRole).mockResolvedValue(false);

    expect(await codeFrom(() => companyIdentityService.getForAdmin("u"))).toBe(
      "FORBIDDEN_NOT_ADMIN"
    );
    expect(await codeFrom(() => companyIdentityService.update("u", {}))).toBe(
      "FORBIDDEN_NOT_ADMIN"
    );
    expect(companyIdentityDal.get).not.toHaveBeenCalled();
    expect(companyIdentityDal.upsert).not.toHaveBeenCalled();
  });

  it("lets finance in, as for the platform fee", async () => {
    vi.mocked(userHasRole).mockImplementation(async (_id, role) => role === "finance");
    await expect(companyIdentityService.getForAdmin("u")).resolves.toBeTruthy();
  });
});

describe("companyIdentityService.getForAdmin", () => {
  it("reports a receipt and every missing field when nothing is set", async () => {
    const view = await companyIdentityService.getForAdmin("admin");

    expect(view.documentType).toBe("receipt");
    expect(view.missing).toEqual(["legalName", "legalForm", "address", "siret", "rcs", "vatRate"]);
    expect(view.values.legalName).toBeNull();
  });

  it("is an invoice once the saved row is complete — no VAT number needed at 0 %", async () => {
    vi.mocked(companyIdentityDal.get).mockResolvedValue(row(COMPLETE) as never);

    const view = await companyIdentityService.getForAdmin("admin");

    expect(view.documentType).toBe("invoice");
    expect(view.missing).toEqual([]);
  });

  it("asks for the VAT number only when VAT is charged", async () => {
    vi.mocked(companyIdentityDal.get).mockResolvedValue(
      row({ ...COMPLETE, vatRate: "20" }) as never
    );

    const view = await companyIdentityService.getForAdmin("admin");

    expect(view.documentType).toBe("receipt");
    expect(view.missing).toEqual(["vatNumber"]);
  });

  it("shows a deployment variable where the row is empty, and the row where it is not", async () => {
    process.env.INVOICE_VAT_RATE = "0";
    process.env.INVOICE_ISSUER_NAME = "From env";
    vi.mocked(companyIdentityDal.get).mockResolvedValue(row({ legalName: "Saved" }) as never);

    const view = await companyIdentityService.getForAdmin("admin");

    expect(view.values.vatRate).toBe("0");
    expect(view.values.legalName).toBe("Saved");
  });
});

describe("companyIdentityService.update", () => {
  it("stores an emptied field as null and strips the spaces people type", async () => {
    await companyIdentityService.update("admin", {
      legalName: "  Atout Global Services ",
      siret: "123 456 789 00012",
      vatNumber: "fr 12 345678901",
      vatRate: "5,5",
      capital: "",
    });

    expect(companyIdentityDal.upsert).toHaveBeenCalledWith({
      legalName: "Atout Global Services",
      siret: "12345678900012",
      vatNumber: "FR12345678901",
      vatRate: "5.5",
      capital: null,
      updatedBy: "admin",
    });
  });

  it.each([
    ["siret", "1234"],
    ["vatNumber", "12345"],
    ["vatRate", "120"],
    ["billingEmail", "not-an-email"],
  ])("refuses a malformed %s before writing", async (field, value) => {
    await expect(
      companyIdentityService.update("admin", { [field]: value })
    ).rejects.toBeInstanceOf(ZodError);
    expect(companyIdentityDal.upsert).not.toHaveBeenCalled();
  });

  it("refuses a field it does not know", async () => {
    await expect(
      companyIdentityService.update("admin", { iban: "FR76…" })
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("companyIdentityService.issuer", () => {
  it("prints the saved identity on documents", async () => {
    vi.mocked(companyIdentityDal.get).mockResolvedValue(row(COMPLETE) as never);

    const issuer = await companyIdentityService.issuer();

    expect(issuer.name).toBe("Atout Global Services");
    expect(issuer.isComplete).toBe(true);
  });

  it("falls back to the variables — a receipt, never a facture — when the row cannot be read", async () => {
    vi.mocked(companyIdentityDal.get).mockRejectedValue(new Error("relation does not exist"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const issuer = await companyIdentityService.issuer();

    expect(issuer.isComplete).toBe(false);
    expect(issuer.name).toBe("Expeditoo");
    spy.mockRestore();
  });
});

describe("companyIdentityService.getPublic", () => {
  it("publishes the legal identity and nothing about billing", async () => {
    vi.mocked(companyIdentityDal.get).mockResolvedValue(
      row({ ...COMPLETE, billingEmail: "compta@atout.fr" }) as never
    );

    const view = await companyIdentityService.getPublic();

    expect(view.siret).toBe("12345678900012");
    expect(view.host).toBe("Vercel Inc.");
    expect(Object.keys(view).sort()).toEqual(
      ["address", "capital", "host", "legalForm", "legalName", "publicationDirector", "rcs", "siret", "vatNumber"]
    );
  });
});
