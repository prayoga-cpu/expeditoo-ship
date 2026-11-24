"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, ClipboardList, MessagesSquare, Truck } from "lucide-react";
import { LP_ANCHOR_OFFSET } from "./styles";

/**
 * « Comment ça marche ? » — three numbered steps for the requester
 * (docs/specs/landing_2026_11_spec.md §3). The carrier's side has its own
 * card in « Vous transportez ».
 */
const STEPS = [
  { key: "step1", icon: ClipboardList },
  { key: "step2", icon: MessagesSquare },
  { key: "step3", icon: Truck },
] as const;

export function LandingHowItWorks() {
  const t = useTranslations("marketing.howItWorks");

  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className={`${LP_ANCHOR_OFFSET} bg-background py-16 lg:py-24`}
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-10 px-4 sm:px-8 lg:gap-14">
        <div className="flex max-w-[40rem] flex-col items-center gap-3 text-center">
          <span className="rounded-full bg-[#eaf2fe] px-3 py-1 text-[0.8rem] font-semibold text-[#0b5bd0] dark:bg-[#11243d] dark:text-[#8fb8ff]">
            {t("eyebrow")}
          </span>
          <h2
            id="how-title"
            className="m-0 text-[1.75rem] leading-tight font-bold tracking-[-0.02em] text-foreground sm:text-[2.1rem]"
          >
            {t("title")}
          </h2>
          <p className="m-0 text-[1rem] leading-relaxed text-pretty text-muted-foreground">
            {t("intro")}
          </p>
        </div>

        <ol className="grid w-full list-none grid-cols-1 gap-5 p-0 md:grid-cols-3 md:gap-6">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <li
              key={key}
              className="relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 pt-7"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary text-[0.95rem] font-bold text-white"
                >
                  {index + 1}
                </span>
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f1f4f8] text-[#3d4652] dark:bg-[#1b232c] dark:text-[#c2cad4]"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
              </div>
              <h3 className="m-0 text-[1.1rem] leading-snug font-semibold text-foreground">
                <span className="sr-only">{t("stepNumber", { n: index + 1 })} </span>
                {t(`${key}.title`)}
              </h3>
              <p className="m-0 text-[0.93rem] leading-[1.6] text-muted-foreground">
                {t(`${key}.desc`)}
              </p>
            </li>
          ))}
        </ol>

        <Link
          href="/create"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[1rem] font-semibold text-white transition-colors hover:bg-[#055bc4] focus-visible:ring-[3px] focus-visible:ring-[rgb(7_107_227/0.4)] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {t("cta")}
          <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
