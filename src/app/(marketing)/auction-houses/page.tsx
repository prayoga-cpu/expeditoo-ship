"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  EXPEDION_URL,
  LP_BODY,
  LP_BTN_GHOST,
  LP_BTN_PRIMARY,
  LP_CONTAINER,
  LP_H3,
  MarketingCardGrid,
  MarketingPageShell,
} from "@/features/marketing/ui";

/**
 * The auction house's side of the bridge.
 *
 * Careful about one thing: a house does not post work here. It accepts and
 * pays a quote inside Expedion, and only a job nobody has taken inside the
 * window reaches this network. Describing Expeditoo as somewhere to shop for
 * transport directly would misstate the product (CLAUDE.md, "Shippers do not
 * post jobs here").
 */
export default function AuctionHousesPage() {
  const t = useTranslations("marketing.auctionHouses");

  return (
    <MarketingPageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      intro={t("intro")}
    >
      <div className={`${LP_CONTAINER} flex flex-col gap-14 pb-4`}>
        <section className="flex flex-col gap-6">
          <h2 className={LP_H3}>{t("flow.title")}</h2>
          <MarketingCardGrid namespace="marketing.auctionHouses.flow" />
        </section>

        <section className="flex flex-col gap-6">
          <h2 className={LP_H3}>{t("guarantees.title")}</h2>
          <MarketingCardGrid
            namespace="marketing.auctionHouses.guarantees"
            numbered={false}
          />
        </section>

        <section className="flex max-w-[720px] flex-col gap-3">
          <h2 className={LP_H3}>{t("notMarketplace.title")}</h2>
          <p className={LP_BODY}>{t("notMarketplace.body")}</p>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <a
            href={EXPEDION_URL}
            target="_blank"
            rel="noreferrer"
            className={`${LP_BTN_PRIMARY} px-7 py-3.5 text-[15px]`}
          >
            {t("cta")}
          </a>
          <Link
            href="/contact"
            className={`${LP_BTN_GHOST} px-6 py-3.5 text-[15px]`}
          >
            {t("ctaSecondary")}
          </Link>
        </section>
      </div>
    </MarketingPageShell>
  );
}
