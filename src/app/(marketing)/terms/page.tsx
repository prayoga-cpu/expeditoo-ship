"use client";

import { useTranslations } from "next-intl";
import { LegalDocument, MarketingPageShell } from "@/features/marketing/ui";

/**
 * Rewritten from the v1 goods-marketplace text, which described "auction and
 * direct sales services", made "sellers" responsible for describing "items",
 * and was hardcoded English on a product that ships FR and EN at parity. None
 * of that is this product: Expeditoo carries transport jobs escalated from
 * Expedion, and an operator awards them.
 */
export default function TermsOfServicePage() {
  const t = useTranslations("marketing.terms");

  return (
    <MarketingPageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      intro={t("intro")}
    >
      <LegalDocument namespace="marketing.terms" />
    </MarketingPageShell>
  );
}
