"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LandingBidCard } from "./LandingBidCard";
import { LandingStats } from "./LandingStats";
import { LP_ANCHOR_OFFSET, LP_BTN_GHOST, LP_BTN_PRIMARY } from "./styles";

const STEPS = ["step1", "step2", "step3"] as const;

function HeroSteps() {
  const t = useTranslations("marketing.hero");

  return (
    <div className="flex flex-wrap items-stretch gap-y-2.5 rounded-[14px] border border-[var(--lp-line)] bg-[var(--lp-chip)] px-[18px] py-3.5">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          {i > 0 && <span className="pr-4 text-[var(--lp-faint)]">→</span>}
          <div className="flex items-center gap-2.5 pr-4">
            <span className="font-mono text-xs text-[var(--lp-bluelink)]">
              {`0${i + 1}`}
            </span>
            <span className="text-[13.5px] text-[var(--lp-muted)]">
              {t(step)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LandingHero() {
  const t = useTranslations("marketing.hero");

  return (
    <section
      id="top"
      className={`lp ${LP_ANCHOR_OFFSET} relative overflow-hidden px-5 pt-14 sm:px-8 lg:pt-[88px]`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[260px] left-1/2 h-[520px] w-[1100px] -translate-x-1/2"
        style={{ background: "var(--lp-glow)" }}
      />
      <div className="relative mx-auto grid w-full max-w-[1180px] grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-[9px] rounded-full border border-[var(--lp-line2)] bg-[var(--lp-chip)] px-3.5 py-[7px] text-[13px] text-[var(--lp-muted)]">
            <span className="h-[7px] w-[7px] rounded-full bg-[var(--lp-green)]" />
            {t("badge")}
          </span>

          <h1 className="m-0 text-[34px] leading-[1.04] font-bold tracking-[-0.035em] text-pretty sm:text-[44px] lg:text-[56px]">
            {t("titleLine1")}
            <br />
            <span className="text-[var(--lp-bluelink)]">{t("titleLine2")}</span>
          </h1>

          <p className="m-0 max-w-[520px] text-[17.5px] leading-[1.6] text-pretty text-[var(--lp-muted)]">
            {t("subtitle")}
          </p>

          <HeroSteps />

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className={`${LP_BTN_PRIMARY} px-[26px] py-[15px] text-base`}
            >
              {t("primaryCta")}
            </Link>
            <Link
              href="/#courses"
              className={`${LP_BTN_GHOST} px-[26px] py-[15px] text-base`}
            >
              {t("secondaryCta")}
            </Link>
          </div>
        </div>

        <LandingBidCard />
      </div>

      <LandingStats />
    </section>
  );
}
