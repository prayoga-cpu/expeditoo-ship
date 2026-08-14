"use client";

import { useTranslations } from "next-intl";
import { LP_CONTAINER, LP_SECTION } from "./styles";

const QUOTES = ["one", "two"] as const;

export function LandingTestimonials() {
  const t = useTranslations("marketing.testimonials");

  return (
    <section className={LP_SECTION}>
      <div className={`${LP_CONTAINER} grid grid-cols-1 gap-4 lg:grid-cols-2`}>
        {QUOTES.map((quote) => (
          <div
            key={quote}
            className="flex flex-col gap-5 rounded-[20px] border border-[var(--lp-line)] bg-[var(--lp-bg2)] p-[30px]"
          >
            <span
              aria-hidden
              className="text-[13px] tracking-[0.14em] text-[var(--lp-amber)]"
            >
              ★★★★★
            </span>
            <p className="m-0 text-lg leading-[1.55] tracking-[-0.01em] text-pretty">
              {t(`${quote}.quote`)}
            </p>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-[34px] w-[34px] flex-none rounded-full border border-[var(--lp-line)] bg-[var(--lp-chip)]"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {t(`${quote}.author`)}
                </span>
                <span className="text-[13px] text-[var(--lp-dim)]">
                  {t(`${quote}.role`)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
