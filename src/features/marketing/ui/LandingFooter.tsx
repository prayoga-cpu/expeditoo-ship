"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BrandWordmark } from "@/components/ui/brand-mark";
import { AppVersionLink } from "@/components/ui/app-version";
import { EXPEDION_URL } from "./styles";

const LINK = "text-sm text-[var(--lp-muted)]";
const HEADING = "text-[13px] font-medium";

/**
 * Four of these used to be placeholders: "Verification" and "Auction houses"
 * both pointed at `/#cta`, the sign-up call to action; "Contact" was a bare
 * `mailto:`; and "Legal notice" opened the terms of service, which is a
 * different document that French law does not accept in its place. Every entry
 * now resolves to the page it names — see
 * docs/specs/marketing_footer_pages_spec.md §1. « Courses ouvertes » and
 * « Plateforme » went in 2.95.0: their sections left the landing page, and an
 * anchor to a missing id scrolls nowhere. 2.96.0 added the requester's column
 * (landing_2026_11_spec.md §3): the landing is theirs first.
 */
const COLUMNS = [
  {
    title: "requesters",
    links: [
      { key: "request", href: "/create" },
      { key: "howItWorks", href: "/#how" },
      { key: "recent", href: "/#recent" },
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
    title: "group",
    links: [
      { key: "expedionBuyers", href: EXPEDION_URL, external: true },
      { key: "auctionHouses", href: "/auction-houses" },
      { key: "changelog", href: "/changelog" },
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

export function LandingFooter({ flush = false }: { flush?: boolean } = {}) {
  const t = useTranslations("marketing.footer");

  // `flush`: the landing's last section carries its own spacing; the content
  // pages end on prose and keep the gap.
  const gap = flush ? "" : "mt-[72px] lg:mt-[110px]";

  return (
    <footer className={`lp ${gap} border-t border-[var(--lp-line)] pt-14 pb-10`}>
      {/* Padded inside the 1200px measure, as the header is: the two
          share one content edge on every marketing page. */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-11 px-5 font-sans sm:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <BrandWordmark size={30} tagline />
            <span className="max-w-[280px] text-sm leading-[1.6] text-[var(--lp-muted)]">
              {t("tagline")}
            </span>
            <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--lp-dim)]">
              EXPEDITOP.FR
            </span>
          </div>
          {COLUMNS.map((column) => (
            <FooterColumn key={column.title} column={column} />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-[var(--lp-line)] pt-7">
          {/* The copyright and the running version, together: one says who
              owns the site, the other says which build of it you are reading,
              and the second is the one a visitor can act on. The column above
              already links to /changelog by name — this is the same page
              reached from the number itself, which is how somebody arrives
              wanting to know what changed. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* `--lp-muted`, not `--lp-faint`: 13px text in faint grey on the
                footer's grey was 3:1, under AA. */}
            <span className="text-[13px] text-[var(--lp-muted)]">
              {t("copyright")}
            </span>
            <AppVersionLink className="text-[var(--lp-muted)] hover:text-[var(--lp-text)]" />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-[var(--lp-muted)]">
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
