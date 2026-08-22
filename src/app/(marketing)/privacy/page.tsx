"use client";

import { useTranslations } from "next-intl";
import { LegalDocument, MarketingPageShell } from "@/features/marketing/ui";

/**
 * Rewritten alongside `/terms`. The previous text collected "bids, purchases"
 * and "messages between users" for a marketplace that no longer exists, and
 * said nothing about the KYC documents this product actually holds — the one
 * category with a real retention rule attached.
 */
export default function PrivacyPolicyPage() {
  const t = useTranslations("marketing.privacy");

  return (
    <MarketingPageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      intro={t("intro")}
    >
      <LegalDocument namespace="marketing.privacy" />
    </MarketingPageShell>
  );
}
