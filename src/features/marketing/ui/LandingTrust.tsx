"use client";

import { useTranslations } from "next-intl";
import { Camera, CreditCard, RotateCcw, ShieldCheck } from "lucide-react";

/**
 * Four things that are true of every request, right under the search card
 * (docs/specs/landing_2026_11_spec.md §3). Each one is a rule the app
 * enforces, not a promise of speed, price or rating:
 *
 * - paid at acceptance — `payment_at_booking_spec.md`, `pay_at_accept_spec.md`
 * - checked transporters — approval is never automatic (`driver_types_spec.md` §3.1)
 * - photos at pickup and delivery — the two moves are refused without one
 *   (`shipment_photos_spec.md`)
 * - refunded on cancellation — both cancel and withdraw refund
 *   (`cancellations_spec.md`)
 */
const ITEMS = [
  { key: "payment", icon: CreditCard },
  { key: "verified", icon: ShieldCheck },
  { key: "photos", icon: Camera },
  { key: "refund", icon: RotateCcw },
] as const;

export function LandingTrust() {
  const t = useTranslations("marketing.trust");

  return (
    <section aria-label={t("label")} className="border-b border-border bg-background">
      <ul className="mx-auto grid w-full max-w-[1200px] list-none grid-cols-1 gap-x-8 gap-y-5 px-4 py-8 sm:grid-cols-2 sm:px-8 lg:py-10 xl:grid-cols-4">
        {ITEMS.map(({ key, icon: Icon }) => (
          <li key={key} className="flex items-start gap-3.5">
            <span
              aria-hidden
              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#eaf2fe] text-[#0b5bd0] dark:bg-[#11243d] dark:text-[#8fb8ff]"
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.95rem] leading-snug font-semibold text-foreground">
                {t(`${key}.title`)}
              </span>
              <span className="text-[0.85rem] leading-[1.5] text-muted-foreground">
                {t(`${key}.desc`)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
