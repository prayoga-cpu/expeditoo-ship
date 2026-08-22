"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BrandWordmark } from "@/components/ui/brand-mark";
import { EXPEDION_URL } from "./styles";

const LINK = "text-sm text-[var(--lp-muted)]";
const HEADING = "text-[13px] font-medium";

/**
 * Four of these used to be placeholders: "Verification" and "Auction houses"
 * both pointed at `/#cta`, the sign-up call to action; "Contact" was a bare
 * `mailto:`; and "Legal notice" opened the terms of service, which is a
 * different document that French law does not accept in its place. Every entry
 * now resolves to the page it names — see
 * docs/specs/marketing_footer_pages_spec.md §1.
 */
const COLUMNS = [
  {
    title: "carriers",
    links: [
      { key: "openJobs", href: "/#courses" },
      { key: "howItWorks", href: "/#how" },
      { key: "verification", href: "/verification" },
      { key: "platform", href: "/#platform" },
    ],
  },
  {
    title: "group",
    links: [
      { key: "expedionBuyers", href: EXPEDION_URL, external: true },
      { key: "auctionHouses", href: "/auction-houses" },
      { key: "contact", href: "/contact" },
    ],
  },
  {
    title: "legal",
    links: [
      { key: "terms", href: "/terms" },
      { key: "legalNotice", href: "/legal-notice" },
      { key: "privacy", href: "/privacy" },
    ],
  },
] as const;

function FooterColumn({ column }: { column: (typeof COLUMNS)[number] }) {
  const t = useTranslations("marketing.footer");

  return (
    <div className="flex flex-col gap-3">
      <span className={HEADING}>{t(column.title)}</span>
      {column.links.map((link) =>
        "external" in link && link.external ? (
          // Expedion is a separate product on its own origin: opening it in a
          // new tab keeps the visitor's place, and `noreferrer` stops the
          // opened page reaching back through `window.opener`.
          <a
            key={link.key}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className={LINK}
          >
            {t(link.key)}
          </a>
        ) : (
          <Link key={link.key} href={link.href} className={LINK}>
            {t(link.key)}
          </Link>
        )
      )}
    </div>
  );
}

export function LandingFooter() {
  const t = useTranslations("marketing.footer");

  return (
    <footer className="lp mt-[72px] border-t border-[var(--lp-line)] px-5 pt-14 pb-10 sm:px-8 lg:mt-[110px]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-11">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <BrandWordmark size={30} />
            <span className="max-w-[280px] text-sm leading-[1.6] text-[var(--lp-muted)]">
              {t("tagline")}
            </span>
            <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--lp-faint)]">
              EXPEDITOO.COM
            </span>
          </div>
          {COLUMNS.map((column) => (
            <FooterColumn key={column.title} column={column} />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-[var(--lp-line)] pt-7">
          <span className="text-[13px] text-[var(--lp-faint)]">
            {t("copyright")}
          </span>
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-[var(--lp-faint)]">
              {t("sameGroup")}
            </span>
            <span
              aria-hidden
              className="h-4 w-4 rounded-[5px] bg-[#FFA91F]"
            />
            <span
              aria-hidden
              className="h-4 w-4 rounded-[5px] bg-[#0052FF]"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
