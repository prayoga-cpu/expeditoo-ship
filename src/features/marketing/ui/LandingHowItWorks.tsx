"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, ClipboardList, MessagesSquare, Truck } from "lucide-react";
import { revealDelay, SectionHeading } from "./LandingSectionHeading";
import { H_BTN_PRIMARY, H_CONTAINER, H_SECTION_Y, LP_ANCHOR_OFFSET } from "./styles";

/**
 * « Comment ça marche ? — Simple et rapide »: the client's reference section
 * (docs/specs/landing_2026_11_spec.md §3), laid out as the reference's three
 * steps joined by dotted connectors — across from `md`, down on a phone.
 * The carrier's side has its own band (« Vous transportez ? »).
 */
const STEPS = [
  { key: "step1", icon: ClipboardList },
  { key: "step2", icon: MessagesSquare },
  { key: "step3", icon: Truck },
] as const;

/**
 * The dotted line to the next step. Phone: down the left, from under this
 * step's disc to the next one's. From `md`: across, from this disc's right
 * edge to the next disc's left edge — a column plus the 2rem gap, less the
 * 88px disc.
 */
function Connector() {
  return (
    <span
      aria-hidden
      className="absolute top-[96px] bottom-[-32px] left-[43px] border-l-2 border-dashed border-[var(--h-line2)] md:top-[44px] md:bottom-auto md:left-[calc(50%+56px)] md:w-[calc(100%+2rem-112px)] md:border-t-2 md:border-l-0"
    />
  );
}

export function LandingHowItWorks() {
  const t = useTranslations("marketing.howItWorks");

  return (
    <section id="how" aria-labelledby="how-title" className={`${LP_ANCHOR_OFFSET} ${H_SECTION_Y} bg-[var(--h-alt)]`}>
      <div className={`${H_CONTAINER} flex flex-col items-center gap-14 lg:gap-20`}>
        <SectionHeading titleId="how-title" eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} centered />

        <ol className="m-0 grid w-full list-none grid-cols-1 gap-10 p-0 md:grid-cols-3 md:gap-8">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <li
              key={key}
              data-reveal
              style={revealDelay(index, 140)}
              className="relative flex gap-5 md:flex-col md:items-center md:gap-6 md:text-center"
            >
              {index < STEPS.length - 1 && <Connector />}
              <span aria-hidden className="relative flex h-[88px] w-[88px] flex-none items-center justify-center rounded-full bg-[var(--h-card)] text-[var(--h-accent-text)] shadow-[var(--h-shadow)] ring-1 ring-[var(--h-line)]">
                <Icon className="h-8 w-8" />
                <span className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary font-mono text-[0.8rem] font-semibold text-white ring-4 ring-[var(--h-alt)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>
              <div className="flex flex-col gap-2 pt-3 md:pt-0">
                <h3 className="m-0 text-[1.25rem] leading-snug font-bold tracking-[-0.02em] text-[var(--h-text)]">
                  <span className="sr-only">{t("stepNumber", { n: index + 1 })} </span>
                  {t(`${key}.title`)}
                </h3>
                <p className="m-0 max-w-[22rem] text-[0.97rem] leading-[1.65] text-[var(--h-muted)]">{t(`${key}.desc`)}</p>
              </div>
            </li>
          ))}
        </ol>

        <Link href="/create" data-reveal className={H_BTN_PRIMARY}>
          {t("cta")}
          <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
