/**
 * Who issues the document, and therefore what the document may call itself.
 *
 * Every legal identifier of the operating company is still a placeholder —
 * `/legal-notice` renders SIRET, RCS, forme juridique, capital and VAT number
 * as *À COMPLÉTER*, and the page itself records that "a registration number is
 * not something to invent". A document headed **Facture** carrying none of them
 * is not a facture; it is a non-conforming document making a claim it cannot
 * support.
 *
 * So the title is derived rather than asserted. With the identity configured
 * the document is a facture and prints the mentions; without it, the same data
 * is a **reçu de paiement** footed with the wording already used on the
 * carrier's relevé — the distinction `billing_documents_spec.md` §3.3 draws for
 * exactly this reason. Filling the mentions légales promotes every document
 * issued from that moment, with no code change and nothing backdated.
 *
 * TODO(EXPEDITOO-LEGAL): set these in the deployment once the company's
 * registration and VAT position are known. See docs/specs/invoice_at_payment_spec.md §4.1.
 */

export interface InvoiceIssuer {
  name: string;
  legalForm?: string;
  address?: string;
  capital?: string;
  siret?: string;
  rcs?: string;
  vatNumber?: string;
  email: string;
  /** Percent. `0` is the franchise en base, which is a position, not silence. */
  vatRate?: number;
  /** Whether this identity can carry the word *facture*. */
  isComplete: boolean;
}

const trimmed = (value: string | undefined) => {
  const text = value?.trim();
  return text ? text : undefined;
};

/** A rate only counts as stated when it parses; `""` is unset, `"0"` is exempt. */
function readVatRate(raw: string | undefined): number | undefined {
  const value = trimmed(raw);
  if (value === undefined) return undefined;

  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : undefined;
}

/**
 * Read at call time, never at import time, so a test can set the identity and
 * the deployment can change it without a rebuild.
 */
export function invoiceIssuer(): InvoiceIssuer {
  const name = trimmed(process.env.INVOICE_ISSUER_NAME) ?? "Expeditoo";
  const legalForm = trimmed(process.env.INVOICE_ISSUER_LEGAL_FORM);
  const address = trimmed(process.env.INVOICE_ISSUER_ADDRESS);
  const siret = trimmed(process.env.INVOICE_ISSUER_SIRET);
  const rcs = trimmed(process.env.INVOICE_ISSUER_RCS);
  const vatNumber = trimmed(process.env.INVOICE_ISSUER_VAT_NUMBER);
  const vatRate = readVatRate(process.env.INVOICE_VAT_RATE);

  // A business under the franchise en base has no VAT number, so requiring one
  // unconditionally would lock out precisely the issuers that are exempt. The
  // number is required only where VAT is actually charged.
  const isComplete = Boolean(
    legalForm &&
      address &&
      siret &&
      rcs &&
      vatRate !== undefined &&
      (vatRate === 0 || vatNumber)
  );

  return {
    name,
    legalForm,
    address,
    capital: trimmed(process.env.INVOICE_ISSUER_CAPITAL),
    siret,
    rcs,
    vatNumber,
    email: trimmed(process.env.INVOICE_ISSUER_EMAIL) ?? "facturation@expeditoo.com",
    vatRate,
    isComplete,
  };
}

/**
 * The VAT sentence the document must carry.
 *
 * A French document states the rate and amount of VAT, or states why there is
 * none. Saying nothing is the one option that is not available: a professional
 * client reads an undifferentiated total as bearing deductible VAT, and it does
 * not.
 */
export function vatMention(issuer: InvoiceIssuer): string {
  if (issuer.vatRate === undefined) {
    return "Ce document ne ventile pas la TVA et ne peut pas servir de justificatif de déduction.";
  }

  if (issuer.vatRate === 0) {
    return "TVA non applicable, article 293 B du CGI.";
  }

  return `TVA au taux de ${issuer.vatRate} %.`;
}
