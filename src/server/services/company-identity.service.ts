import { companyIdentityDal } from "@/server/dal/company-identity.dal";
import { userHasRole } from "@/server/dal/users.dal";
import { invoiceIssuer, type InvoiceIssuer } from "@/lib/invoice-issuer";
import {
  COMPANY_IDENTITY_FIELDS,
  updateCompanyIdentitySchema,
  type CompanyIdentityAdminView,
  type CompanyIdentityField,
  type CompanyIdentityPublicView,
  type CompanyIdentityValues,
  type FactureBlocker,
} from "@/server/dto/company-identity.dto";
import type { CompanyIdentityRow } from "@/db/schema/company-identity";

// ========================================
// Company identity — launch_readiness_spec.md §A
// ========================================

export class CompanyIdentityError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "CompanyIdentityError";
  }
}

/** Same people who set the platform fee: admin or finance. */
async function requireSettingsAdmin(actorUserId: string) {
  const [isAdmin, isFinance] = await Promise.all([
    userHasRole(actorUserId, "admin"),
    userHasRole(actorUserId, "finance"),
  ]);
  if (!isAdmin && !isFinance) {
    throw new CompanyIdentityError("FORBIDDEN_NOT_ADMIN", 403);
  }
}

/** The deployment variable each field falls back to, when there is one. */
const ENV_FALLBACK: Partial<Record<CompanyIdentityField, string>> = {
  legalName: "INVOICE_ISSUER_NAME",
  legalForm: "INVOICE_ISSUER_LEGAL_FORM",
  capital: "INVOICE_ISSUER_CAPITAL",
  address: "INVOICE_ISSUER_ADDRESS",
  siret: "INVOICE_ISSUER_SIRET",
  rcs: "INVOICE_ISSUER_RCS",
  vatNumber: "INVOICE_ISSUER_VAT_NUMBER",
  vatRate: "INVOICE_VAT_RATE",
  billingEmail: "INVOICE_ISSUER_EMAIL",
};

const present = (value: string | null | undefined) => {
  const text = value?.trim();
  return text ? text : null;
};

/** Saved value first, then the variable — the same order the issuer reads. */
function effectiveValues(row: CompanyIdentityRow | null | undefined): CompanyIdentityValues {
  const values = {} as CompanyIdentityValues;
  for (const field of COMPANY_IDENTITY_FIELDS) {
    const envName = ENV_FALLBACK[field];
    values[field] =
      present(row?.[field]) ?? (envName ? present(process.env[envName]) : null);
  }
  return values;
}

/** What still keeps the documents from being factures, by the issuer's own rule. */
export function factureBlockers(issuer: InvoiceIssuer, nameStated: boolean): FactureBlocker[] {
  const missing: FactureBlocker[] = [];
  if (!nameStated) missing.push("legalName");
  if (!issuer.legalForm) missing.push("legalForm");
  if (!issuer.address) missing.push("address");
  if (!issuer.siret) missing.push("siret");
  if (!issuer.rcs) missing.push("rcs");
  if (issuer.vatRate === undefined) missing.push("vatRate");
  else if (issuer.vatRate !== 0 && !issuer.vatNumber) missing.push("vatNumber");
  return missing;
}

/**
 * The stored row, or none when it cannot be read. A missing table (code
 * deployed before its migration) or a database hiccup must not stop a receipt
 * from rendering: without the row the document falls back to the variables,
 * which is the conservative direction — a reçu, never a facture it cannot back.
 */
async function readRow() {
  try {
    return (await companyIdentityDal.get()) ?? null;
  } catch (error) {
    console.error("[company-identity] read failed, using deployment variables", error);
    return null;
  }
}

function adminView(row: CompanyIdentityRow | null): CompanyIdentityAdminView {
  const values = effectiveValues(row);
  const issuer = invoiceIssuer(row);
  const missing = factureBlockers(issuer, values.legalName !== null);
  return {
    values,
    documentType: issuer.isComplete ? "invoice" : "receipt",
    missing,
    updatedAt: row?.updatedAt ?? null,
  };
}

/** `""` is stored as null so a cleared field falls back, never prints blank. */
function toColumns(input: Record<string, string | undefined>) {
  const columns: Partial<Record<CompanyIdentityField, string | null>> = {};
  for (const field of COMPANY_IDENTITY_FIELDS) {
    const value = input[field];
    if (value !== undefined) columns[field] = value === "" ? null : value;
  }
  return columns;
}

export const companyIdentityService = {
  /** The issuer every payment document prints — no permission, no throw. */
  async issuer(): Promise<InvoiceIssuer> {
    return invoiceIssuer(await readRow());
  },

  async getForAdmin(actorUserId: string): Promise<CompanyIdentityAdminView> {
    await requireSettingsAdmin(actorUserId);
    return adminView((await companyIdentityDal.get()) ?? null);
  },

  async update(actorUserId: string, input: unknown): Promise<CompanyIdentityAdminView> {
    await requireSettingsAdmin(actorUserId);
    const parsed = updateCompanyIdentitySchema.parse(input);
    const row = await companyIdentityDal.upsert({
      ...toColumns(parsed),
      updatedBy: actorUserId,
    });
    return adminView(row);
  },

  /** For the mentions légales: public by law, so no session is needed. */
  async getPublic(): Promise<CompanyIdentityPublicView> {
    const v = effectiveValues(await readRow());
    return {
      legalName: v.legalName,
      legalForm: v.legalForm,
      capital: v.capital,
      address: v.address,
      siret: v.siret,
      rcs: v.rcs,
      vatNumber: v.vatNumber,
      publicationDirector: v.publicationDirector,
      host: v.host,
    };
  },
};
