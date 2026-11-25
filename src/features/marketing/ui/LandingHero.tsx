"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDown, Check } from "lucide-react";
import { LandingHeroVideo } from "./LandingHeroVideo";
import { LandingSearchCard } from "./LandingSearchCard";
import { revealDelay } from "./LandingSectionHeading";
import { LP_ANCHOR_OFFSET } from "./styles";
import styles from "./landing.module.css";

/** One badge on the page, so its circle can carry a fixed id. */
const BADGE_PATH_ID = "lp-how-badge-path";

/**
 * A slowly turning ring of words around an arrow, pointing at « Comment ça
 * marche ? » — the reference's rotating badge, on our blue. The ring is
 * decoration; the link's name is its own label. From `md`: on a phone the
 * card is the whole screen's job.
 */
function HowBadge() {
  const t = useTranslations("marketing.hero");
  return (
    <Link
      href="/#how"
      aria-label={t("howLink")}
      className="group relative block h-[116px] w-[116px] flex-none rounded-full focus-visible:ring-[3px] focus-visible:ring-white focus-visible:outline-none"
    >
      <svg viewBox="0 0 120 120" aria-hidden className={`${styles.spin} absolute inset-0 h-full w-full`}>
        <defs>
          <path id={BADGE_PATH_ID} d="M60,60 m-47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0" />
        </defs>
        <text className="fill-white text-[10.5px] font-semibold uppercase">
          <textPath href={`#${BADGE_PATH_ID}`} textLength={292} lengthAdjust="spacing">
            {t("howBadge")}
          </textPath>
        </text>
      </svg>
      <span
        aria-hidden
        className="absolute inset-[31px] flex items-center justify-center rounded-full bg-white text-[#076be3] transition-transform duration-300 group-hover:translate-y-0.5"
      >
        <ArrowDown className="h-6 w-6" />
      </span>
    </Link>
  );
}

/**
 * What the site is for, in one line, centred above both columns (client
 * feedback 2026-11-25: higher, in the middle, in a larger type). It used to
 * sit at the top of the left column in 0.8rem.
 */
function HeroBadge() {
  const t = useTranslations("marketing.hero");
  return (
    <span
      className={`${styles.blurIn} inline-flex max-w-full items-center gap-2.5 rounded-[18px] border border-[rgb(255_255_255/0.28)] bg-[rgb(255_255_255/0.1)] px-4 py-2 text-center text-[0.95rem] leading-snug font-medium text-white backdrop-blur-sm sm:rounded-full sm:px-5 sm:py-2.5 sm:text-[1.1rem]`}
    >
      <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-[#7CF0B5]" />
      {t("badge")}
    </span>
  );
}

function HeroCopy() {
  const t = useTranslations("marketing.hero");
  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-7">
      <h1
        id="hero-title"
        className={`${styles.blurIn} m-0 max-w-[13ch] text-[2.55rem] leading-[1] font-extrabold tracking-[-0.045em] text-balance sm:text-[3.6rem] lg:text-[4.1rem] xl:text-[4.6rem]`}
        style={revealDelay(1)}
      >
        {t("title")}
      </h1>
      {/* The badge sits beside the subline while the hero is stacked
          (`md`–`xl`) and under it once the card has its own column. */}
      <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between xl:flex-col xl:items-start">
        <p
          className={`${styles.blurIn} m-0 max-w-[32rem] text-[1.05rem] leading-[1.6] text-pretty text-[#e4eeff] sm:text-[1.15rem]`}
          style={revealDelay(2)}
        >
          {t("subtitle")}
        </p>
        <div className={`${styles.blurIn} hidden flex-none md:block`} style={revealDelay(4)}>
          <HowBadge />
        </div>
      </div>
    </div>
  );
}

/**
 * The first screen (docs/specs/landing_2026_11_spec.md §2): a full-bleed
 * video under a deep brand-blue shade (the reference's hero, in our colour),
 * one sentence for the person who needs something moved, and the card that
 * starts it — the client's reference band. Headline left and card right from
 * `xl`; stacked below it, the card at most 40rem wide (at 1024px a column
 * left it too narrow for its four labels). The floating header sits over the top, so the
 * section pads itself clear of it rather than the header taking a row.
 */
export function LandingHero() {
  const t = useTranslations("marketing.hero");

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className={`${LP_ANCHOR_OFFSET} relative isolate overflow-hidden text-white`}
    >
      <LandingHeroVideo />
      <div aria-hidden className={`${styles.heroShade} absolute inset-0 -z-10`} />
      <div className="mx-auto flex w-full max-w-[1200px] flex-col px-4 pt-[92px] sm:px-8 sm:pt-[104px] xl:min-h-[min(100svh,960px)] xl:pt-[100px]">
        <div className="flex justify-center">
          <HeroBadge />
        </div>
        <div className="grid grid-cols-1 gap-10 pt-8 pb-14 sm:pb-20 lg:pb-20 xl:flex-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-center xl:gap-14">
          <HeroCopy />
          <div className={`${styles.blurIn} flex w-full max-w-[40rem] min-w-0 flex-col gap-4`} style={revealDelay(3)}>
            <LandingSearchCard />
            <p className="m-0 flex items-start gap-2 px-1 text-[0.85rem] leading-snug text-[#e4eeff]">
              <Check className="mt-px h-4 w-4 flex-none" aria-hidden />
              {t("note")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
