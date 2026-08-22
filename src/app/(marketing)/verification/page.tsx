"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  LP_BODY,
  LP_BTN_PRIMARY,
  LP_CONTAINER,
  LP_H3,
  MarketingCardGrid,
  MarketingPageShell,
} from "@/features/marketing/ui";

/**
 * What a driver must supply to be approved, and what happens to it afterwards.
 * Reached from the footer's "Verification", which used to drop the visitor on
 * the sign-up call to action with none of this answered.
 */
export default function VerificationPage() {
  const t = useTranslations("marketing.verification");

  return (
    <MarketingPageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      intro={t("intro")}
    >
      <div className={`${LP_CONTAINER} flex flex-col gap-14 pb-4`}>
        <section className="flex flex-col gap-6">
          <h2 className={LP_H3}>{t("requirements.title")}</h2>
          <MarketingCardGrid namespace="marketing.verification.requirements" />
        </section>

        <section className="flex flex-col gap-6">
          <h2 className={LP_H3}>{t("process.title")}</h2>
          <MarketingCardGrid namespace="marketing.verification.process" />
        </section>

        <section className="flex max-w-[720px] flex-col gap-3">
          <h2 className={LP_H3}>{t("privacy.title")}</h2>
          <p className={LP_BODY}>{t("privacy.body")}</p>
          <p className={LP_BODY}>{t("privacy.expiry")}</p>
        </section>

        <section className="flex flex-wrap items-center gap-4">
          <Link
            href="/signup"
            className={`${LP_BTN_PRIMARY} px-7 py-3.5 text-[15px]`}
          >
            {t("cta")}
          </Link>
          <Link href="/contact" className="text-[15px] text-[var(--lp-muted)]">
            {t("ctaSecondary")}
          </Link>
        </section>
      </div>
    </MarketingPageShell>
  );
}
