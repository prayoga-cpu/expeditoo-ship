import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./users";

// ========================================
// Company identity — who publishes the site and issues the documents
// ========================================
//
// One row (`id = "default"`), edited by an admin at /admin/settings. It feeds
// two things the law reads: the mentions légales page and the identity printed
// on every payment document, which is a *facture* only once this is complete
// (launch_readiness_spec.md §A). Every column is nullable because none of it
// may be invented — an empty value renders as missing, never as a guess.
//
// The `INVOICE_ISSUER_*` environment variables still work as a fallback for a
// column left empty here, so a deployment that already set them loses nothing.

export const companyIdentity = pgTable("company_identity", {
  id: text("id").primaryKey(),
  legalName: text("legal_name"),
  legalForm: text("legal_form"),
  capital: text("capital"),
  address: text("address"),
  /** 14 digits, stored without spaces. */
  siret: text("siret"),
  /** As printed: « RCS Nanterre 123 456 789 ». */
  rcs: text("rcs"),
  vatNumber: text("vat_number"),
  /**
   * Percent, as text so `"0"` (franchise en base, a stated position) stays
   * distinct from null (nothing stated). Parsed by `readVatRate`.
   */
  vatRate: text("vat_rate"),
  billingEmail: text("billing_email"),
  publicationDirector: text("publication_director"),
  /** The hosting provider's name and postal address, for the legal notice. */
  host: text("host"),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type CompanyIdentityRow = typeof companyIdentity.$inferSelect;
export type InsertCompanyIdentity = typeof companyIdentity.$inferInsert;
