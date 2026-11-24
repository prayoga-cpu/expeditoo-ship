"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { BrandWordmark } from "@/components/ui/brand-mark";
import { AppVersionLink } from "@/components/ui/app-version";
import { LandingLangToggle, LandingThemeToggle } from "./LandingControls";
import { EXPEDION_URL } from "./styles";
import styles from "./landing.module.css";

// `!`: `.lp a:hover` (globals.css, unlayered) would otherwise paint it blue.
const LINK = "text-[0.92rem] text-[var(--lp-muted)] transition-colors hover:text-white!";
const HEADING = "text-[0.8rem] font-semibold tracking-[0.06em] text-white uppercase";

/**
 * Every entry resolves to the page it names (marketing_footer_pages_spec.md
 * §1; `LandingFooter.test.tsx` checks each internal path has a page on
 * disk). « Courses ouvertes » and « Plateforme » went in 2.95.0: their
 * sections left the landing page, and an anchor to a missing id scrolls
 * nowhere. 2.97.0 regrouped the columns in the reference's manner — who you
 * are, then help and the legal pages — and moved Expedion, the group's other
 * product and the footer's only outside link, to the bottom line.
 */
const COLUMNS = [
  {
    title: "requesters",
    links: [
      { key: "request", href: "/create" },
      { key: "howItWorks", href: "/#how" },
      { key: "recent", href: "/#recent" },
      { key: "auctionHouses", href: "/auction-houses" },
    ],
  },
  {
    title: "carriers",
    links: [
      { key: "becomeCarrier", href: "/#carriers" },
      { key: "verification", href: "/verification" },
    ],
  },
  {
    title: "helpLegal",
    links: [
      { key: "help", href: "/help" },
      { key: "contact", href: "/contact" },
      { key: "changelog", href: "/changelog" },
      { key: "terms", href: "/terms" },
      { key: "legalNotice", href: "/legal-notice" },
      { key: "privacy", href: "/privacy" },
    ],
  },
] as const;

function FooterColumn({ column }: { column: (typeof COLUMNS)[number] }) {
  const t = useTranslations("marketing.footer");

  return (
    <nav aria-label={t(column.title)} className="flex flex-col gap-4">
      <span className={HEADING}>{t(column.title)}</span>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {column.links.map((link) => (
          <li key={link.key}>
            <Link href={link.href} className={LINK}>
              {t(link.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Who owns the site, which build this is, the group, and the two preferences. */
function BottomLine() {
  const t = useTranslations("marketing.footer");
  return (
    <div className="flex flex-col gap-6 border-t border-[var(--lp-line)] pt-8 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13px] text-[var(--lp-muted)]">{t("copyright")}</span>
        <AppVersionLink className="text-[var(--lp-muted)] hover:text-white" />
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13px] text-[var(--lp-muted)]">
        <span aria-hidden className="h-3.5 w-3.5 rounded-[4px] bg-[#FFA91F]" />
        <span aria-hidden className="h-3.5 w-3.5 rounded-[4px] bg-[#0052FF]" />
        <span>{t("sameGroup")}</span>
        {/* Expedion is a separate product on its own origin: a new tab keeps
            the visitor's place, and `noreferrer` stops the opened page
            reaching back through `window.opener`. */}
        <a href={EXPEDION_URL} target="_blank" rel="noreferrer" className={`${LINK} inline-flex items-center gap-1 text-[13px]`}>
          {t("expedionBuyers")}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
      <div className="flex items-center gap-2">
        <LandingLangToggle />
        <LandingThemeToggle />
      </div>
    </div>
  );
}

/**
 * The marketing footer, in the reference's manner and our brand: the
 * wordmark and one line on the left, three columns, then the bottom line.
 * Navy in both themes (`landing.module.css` `.footer` re-points the `lp`
 * palette). No socials and no newsletter: there are none.
 */
export function LandingFooter({ flush = false }: { flush?: boolean } = {}) {
  const t = useTranslations("marketing.footer");
  // `flush`: the landing's last section carries its own spacing; the content
  // pages end on prose and keep the gap.
  const gap = flush ? "" : "mt-[72px] lg:mt-[110px]";

  return (
    <footer className={`lp ${styles.footer} ${gap}`}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-14 px-5 pt-16 pb-10 font-sans sm:px-8 lg:pt-24">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-5 sm:col-span-2 lg:col-span-1">
            <BrandWordmark size={32} tagline />
            <p className="m-0 max-w-[320px] text-[0.92rem] leading-[1.7] text-[var(--lp-muted)]">{t("tagline")}</p>
          </div>
          {COLUMNS.map((column) => (
            <FooterColumn key={column.title} column={column} />
          ))}
        </div>
        <BottomLine />
      </div>
    </footer>
  );
}
