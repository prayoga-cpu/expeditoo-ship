"use client";

import { useTranslations } from "next-intl";
import {
  LP_CARD,
  LP_CONTAINER,
  LP_EYEBROW,
  LP_H2,
  LP_SECTION,
} from "./styles";

const ITEMS = [
  { key: "item1", swatch: "border-[rgba(0,82,255,0.3)] bg-[rgba(0,82,255,0.14)]" },
  { key: "item3", swatch: "border-[var(--lp-greenbg)] bg-[var(--lp-greenbg)]" },
] as const;

export function LandingAdvantages() {
  const t = useTranslations("marketing.advantages");

  return (
    <section className={LP_SECTION}>
      <div className={`${LP_CONTAINER} flex flex-col gap-9`}>
        <div className="flex max-w-[640px] flex-col gap-3.5">
          <span className={LP_EYEBROW}>{t("eyebrow")}</span>
          <h2 className={LP_H2}>{t("title")}</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ITEMS.map((item) => (
            <div key={item.key} className={`${LP_CARD} box-border gap-[11px]`}>
              <span
                aria-hidden
                className={`h-8 w-8 rounded-[10px] border ${item.swatch}`}
              />
              <span className="text-[16.5px] font-semibold">
                {t(`${item.key}.title`)}
              </span>
              <span className="text-sm leading-[1.6] text-[var(--lp-muted)]">
                {t(`${item.key}.desc`)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
