"use client";

import { useTranslations } from "next-intl";
import {
  resolveIdentityRows,
  usePublicCompany,
  type IdentityRow,
} from "@/features/marketing/hooks/useLegalIdentity";
import {
  LegalDocument,
  LP_H3,
  LP_PROSE_CONTAINER,
  MarketingPageShell,
} from "@/features/marketing/ui";

/**
 * Mentions légales.
 *
 * French law requires a publisher's identity here — legal form, share capital,
 * RCS/SIRET, registered address, publication director — plus the host's name
 * and address. None of that exists anywhere in this repository, and a
 * registration number is not something to invent: a wrong one on a public
 * legal page is worse than a visibly missing one.
 *
 * The values come from the company details an admin saves at /admin/settings
 * (`GET /api/public/company`, launch_readiness_spec.md §A.4). A row whose
 * value has not been saved keeps its unmistakable placeholder, so the page
 * cannot look complete while it is not.
 */

function isIdentityRow(value: unknown): value is IdentityRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.label === "string" && typeof row.value === "string";
}

function IdentityTable({ rows }: { rows: IdentityRow[] }) {
  return (
    <dl className="m-0 flex flex-col divide-y divide-[var(--lp-line)] rounded-[20px] border border-[var(--lp-line)] bg-[var(--lp-bg2)]">
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-baseline sm:gap-6"
        >
          <dt className="text-[13px] font-medium sm:w-[210px] sm:shrink-0">
            {row.label}
          </dt>
          <dd className="m-0 text-[15px] leading-[1.6] [overflow-wrap:anywhere]">
            {row.pending ? (
              <span className="rounded-md bg-[var(--lp-chip)] px-2 py-0.5 font-mono text-[12.5px] text-[var(--lp-ambertext)]">
                {row.value}
              </span>
            ) : (
              <span className="text-[var(--lp-muted)]">{row.value}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function LegalNoticePage() {
  const t = useTranslations("marketing.legalNotice");
  const company = usePublicCompany();
  const raw = t.raw("identity");
  const rows = resolveIdentityRows(
    Array.isArray(raw) ? raw.filter(isIdentityRow) : [],
    company
  );

  return (
    <MarketingPageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      intro={t("intro")}
    >
      <div className={`${LP_PROSE_CONTAINER} flex flex-col gap-9 pb-4`}>
        <section className="flex flex-col gap-4">
          <h2 className={LP_H3}>{t("identityTitle")}</h2>
          <IdentityTable rows={rows} />
          {rows.some((row) => row.pending) && (
            <p className="m-0 text-[13px] leading-[1.6] text-[var(--lp-ambersub)]">
              {t("pendingNote")}
            </p>
          )}
        </section>
      </div>

      <LegalDocument namespace="marketing.legalNotice" />
    </MarketingPageShell>
  );
}
