"use client";

import { useTranslations } from "next-intl";
import { LP_GRID_4 } from "./styles";

const STATS = [
  { value: "320+", key: "jobsPerMonth" },
  { value: "6h", key: "timeToAward" },
  { value: "−38%", key: "emptyKm" },
  { value: "J+7", key: "guaranteedPayment" },
] as const;

export function LandingStats() {
  const t = useTranslations("marketing.stats");

  return (
    <div className={`${LP_GRID_4} mx-auto mt-16 w-full max-w-[1180px]`}>
      {STATS.map((stat) => (
        <div
          key={stat.key}
          className="flex flex-col gap-1.5 rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-bg2)] p-6"
        >
          <span className="font-mono text-[30px] font-medium tracking-[-0.02em]">
            {stat.value}
          </span>
          <span className="text-sm text-[var(--lp-muted)]">{t(stat.key)}</span>
        </div>
      ))}
    </div>
  );
}
