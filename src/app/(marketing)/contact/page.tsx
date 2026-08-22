"use client";

import { useTranslations } from "next-intl";
import {
  ContactForm,
  LP_BODY,
  LP_CARD,
  LP_CONTAINER,
  LP_H3,
  MarketingPageShell,
} from "@/features/marketing/ui";

/**
 * Replaces the footer's bare `mailto:`, which assumed a configured mail client
 * and gave a visitor without one no way through at all.
 */
const CHANNELS = [
  { key: "support", address: "support@expeditoo.com" },
  { key: "carriers", address: "transporteurs@expeditoo.com" },
  { key: "privacy", address: "privacy@expeditoo.com" },
] as const;

export default function ContactPage() {
  const t = useTranslations("marketing.contact");

  return (
    <MarketingPageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      intro={t("intro")}
    >
      <div
        className={`${LP_CONTAINER} grid grid-cols-1 gap-8 pb-4 lg:grid-cols-[1.5fr_1fr]`}
      >
        <ContactForm />

        <aside className="flex flex-col gap-4">
          <div className={`${LP_CARD} gap-4`}>
            <h2 className={LP_H3}>{t("channels.title")}</h2>
            {CHANNELS.map((channel) => (
              <div key={channel.key} className="flex flex-col gap-1">
                <span className="text-[13px] font-medium">
                  {t(`channels.${channel.key}`)}
                </span>
                <a
                  href={`mailto:${channel.address}`}
                  className="text-sm text-[var(--lp-bluelink)] [overflow-wrap:anywhere]"
                >
                  {channel.address}
                </a>
              </div>
            ))}
          </div>

          <div className={`${LP_CARD} gap-2.5`}>
            <h2 className={LP_H3}>{t("response.title")}</h2>
            <p className={LP_BODY}>{t("response.body")}</p>
          </div>
        </aside>
      </div>
    </MarketingPageShell>
  );
}
