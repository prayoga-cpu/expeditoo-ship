"use client";

import { useTranslations } from "next-intl";
import {
  LP_CARD,
  LP_CONTAINER,
  LP_EYEBROW,
  LP_GRID_4,
  LP_H2,
  LP_SECTION,
} from "./styles";

const STEPS = [
  { key: "step1", index: "01", tone: "text-[var(--lp-ambertext)]" },
  { key: "step2", index: "02", tone: "text-[var(--lp-bluelink)]" },
  { key: "step3", index: "03", tone: "text-[var(--lp-bluelink)]" },
  { key: "step4", index: "04", tone: "text-[var(--lp-green)]" },
] as const;

export function LandingHowItWorks() {
  const t = useTranslations("marketing.howItWorks");

  return (
    <section id="how" className={LP_SECTION}>
      <div className={`${LP_CONTAINER} flex flex-col gap-9`}>
        <div className="flex flex-wrap items-end justify-between gap-10">
          <div className="flex max-w-[620px] flex-col gap-3.5">
            <span className={LP_EYEBROW}>{t("eyebrow")}</span>
            <h2 className={LP_H2}>{t("title")}</h2>
          </div>
          <p className="m-0 max-w-[380px] text-base leading-[1.6] text-pretty text-[var(--lp-muted)]">
            {t("intro")}
          </p>
        </div>

        <div className={LP_GRID_4}>
          {STEPS.map((step) => (
            <div key={step.key} className={`${LP_CARD} box-border gap-3`}>
              <span className={`font-mono text-xs ${step.tone}`}>
                {step.index}
              </span>
              <span className="text-[16.5px] font-semibold tracking-[-0.01em]">
                {t(`${step.key}.title`)}
              </span>
              <span className="text-sm leading-[1.6] text-[var(--lp-muted)]">
                {t(`${step.key}.desc`)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
