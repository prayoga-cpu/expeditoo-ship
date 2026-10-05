"use client";

import { useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/currency";
import { LP_GRID_4 } from "./styles";

/**
 * The smallest balance a driver can ask to have transferred:
 * `MIN_WITHDRAWAL_CENTS` (withdrawals.service.ts), restated because that
 * module is server-only. payout-claims.test.ts fails if the two part.
 *
 * This tile was « J+7 — Paiement garanti ». A delivery only credits the
 * balance, and the transfer is made by hand when the driver asks for it
 * (payout_safety_spec.md §0): no delay to promise, and no guarantee.
 */
const TRANSFER_MINIMUM_CENTS = 2_000;

const STATS = [
  { value: "320+", key: "jobsPerMonth" },
  { value: "6h", key: "timeToAward" },
  { value: "−38%", key: "emptyKm" },
  {
    value: formatCurrency(TRANSFER_MINIMUM_CENTS, { fractionDigits: 0 }),
    key: "transferMinimum",
  },
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
