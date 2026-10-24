"use client";

import { useTranslations } from "next-intl";

import { formatQuoteReference } from "@/lib/quote-reference";
import type { QuoteRow } from "@/server/dal/expedion-report.dal";

/**
 * A quote's numbers, ours first: « DEV-04659 », then the Airtable number or
 * the client's bordereau number under it when there is one
 * (client_feedback_2026_10_21_spec.md §A3). The id stays in the tooltip — it
 * is what the client's own screen shows, so support can still match the two.
 */
export function QuoteReferenceCell({ quote }: { quote: QuoteRow }) {
  const t = useTranslations("admin.expedion.table");
  const ours = quote.quoteRef ? formatQuoteReference(quote.quoteRef) : null;
  const secondary = quote.reference
    ? quote.referenceIsAirtable
      ? t("airtableNumber", { number: quote.reference })
      : t("bordereauNumber", { number: quote.reference })
    : null;

  return (
    <div className="min-w-0" title={quote.id}>
      <div className="font-mono text-xs">
        {ours ?? quote.reference ?? quote.id.slice(0, 8)}
      </div>
      {ours && secondary ? (
        <div className="text-muted-foreground/70 truncate font-mono text-[10px]">
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

/** Every number a quote answers to, for the toolbar search. */
export function quoteSearchText(quote: QuoteRow): string[] {
  return [
    quote.quoteRef ? formatQuoteReference(quote.quoteRef) : null,
    quote.quoteRef ? String(quote.quoteRef) : null,
    quote.reference,
    quote.id,
  ].filter((value): value is string => Boolean(value));
}
