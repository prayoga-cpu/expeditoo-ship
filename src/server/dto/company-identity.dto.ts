import { z } from "zod";

// ========================================
// Company identity — launch_readiness_spec.md §A
// ========================================

/** `""` clears a field; every value is trimmed. */
const text = (max: number) => z.string().trim().max(max);

/** Spaces are how people type a SIRET; they are not part of it. */
const siret = z
  .string()
  .transform((v) => v.replace(/\s+/g, ""))
  .refine((v) => v === "" || /^\d{14}$/.test(v), "SIRET_14_DIGITS");

/** « FR 12 345678901 » → « FR12345678901 ». */
const vatNumber = z
  .string()
  .transform((v) => v.replace(/\s+/g, "").toUpperCase())
  .refine((v) => v === "" || /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(v), "VAT_NUMBER_FORMAT");

/** A percent between 0 and 100; « 5,5 » is read as 5.5. `"0"` is a position. */
const vatRate = z
  .string()
  .transform((v) => v.trim().replace(",", "."))
  .refine((v) => {
    if (v === "") return true;
    const rate = Number(v);
    return Number.isFinite(rate) && rate >= 0 && rate <= 100;
  }, "VAT_RATE_RANGE");

const email = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "EMAIL_FORMAT");

export const updateCompanyIdentitySchema = z
  .object({
    legalName: text(160),
    legalForm: text(80),
    capital: text(80),
    address: text(300),
    siret,
    rcs: text(120),
    vatNumber,
    vatRate,
    billingEmail: email,
    publicationDirector: text(160),
    host: text(300),
  })
  .partial()
  .strict();

export type UpdateCompanyIdentityInput = z.infer<
  typeof updateCompanyIdentitySchema
>;

export const COMPANY_IDENTITY_FIELDS = [
  "legalName",
  "legalForm",
  "capital",
  "address",
  "siret",
  "rcs",
  "vatNumber",
  "vatRate",
  "billingEmail",
  "publicationDirector",
  "host",
] as const;

export type CompanyIdentityField = (typeof COMPANY_IDENTITY_FIELDS)[number];

/** Every field, as the form shows it: the saved value or the deployment's. */
export type CompanyIdentityValues = Record<CompanyIdentityField, string | null>;

/** The fields a facture still needs, in the order the form lists them. */
export type FactureBlocker =
  | "legalName"
  | "legalForm"
  | "address"
  | "siret"
  | "rcs"
  | "vatRate"
  | "vatNumber";

export interface CompanyIdentityAdminView {
  values: CompanyIdentityValues;
  /** `invoice` once complete; `receipt` until then. */
  documentType: "invoice" | "receipt";
  missing: FactureBlocker[];
  updatedAt: Date | null;
}

/** What the mentions légales page prints. Public by law. */
export type CompanyIdentityPublicView = Omit<
  CompanyIdentityValues,
  "vatRate" | "billingEmail"
>;
