"use client";

import { useTranslations } from "next-intl";
import { EXPEDION_URL } from "./styles";

/** Cross-sell strip pointing auction buyers at the sibling Expedion app. */
export function LandingBanner() {
  const t = useTranslations("marketing.banner");

  return (
    <div className="lp border-b border-[var(--lp-line)] bg-[rgba(255,169,31,0.08)]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-center gap-2.5 px-5 py-[9px] text-center sm:px-8">
        <span className="text-[13px] text-[var(--lp-muted)]">{t("text")}</span>
        <a
          href={EXPEDION_URL}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] font-medium whitespace-nowrap text-[var(--lp-ambertext)]"
        >
          {t("cta")}
        </a>
      </div>
    </div>
  );
}
