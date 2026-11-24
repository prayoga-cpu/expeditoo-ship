"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { LandingSearchCard } from "./LandingSearchCard";
import { LANDING_IMAGES } from "./landing-images";
import { LP_ANCHOR_OFFSET } from "./styles";
import styles from "./landing.module.css";

/**
 * The first screen (docs/specs/landing_2026_11_spec.md §2): one sentence for
 * the person who needs something moved, and the card that starts it. The
 * structure is the reference the client pointed at — a blue band, a white
 * card of four fields and one wide button — in Expeditop's own words, blue
 * and photograph.
 *
 * The photo is one element placed twice by CSS: below `lg` it lies behind the
 * band under a blue shade (texture, never competing with the text); from `lg`
 * it is a framed picture beside the text. One file, one download.
 */
export function LandingHero() {
  const t = useTranslations("marketing.hero");
  const tImages = useTranslations("marketing.images");
  const image = LANDING_IMAGES.hero;

  return (
    <section
      id="top"
      className={`${styles.band} ${LP_ANCHOR_OFFSET} relative isolate overflow-hidden text-white`}
    >
      <div className="relative mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-10 px-4 pt-10 pb-12 sm:px-8 sm:pt-14 sm:pb-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-center lg:gap-14 lg:py-20">
        <div className="relative z-10 flex min-w-0 flex-col gap-5 sm:gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgb(255_255_255/0.28)] bg-[rgb(255_255_255/0.1)] px-3 py-1.5 text-[0.8rem] font-medium text-white">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#7CF0B5]" />
            {t("badge")}
          </span>

          <h1 className="m-0 max-w-[16ch] text-[2.1rem] leading-[1.08] font-bold tracking-[-0.025em] text-balance sm:text-[2.75rem] lg:text-[3.25rem]">
            {t("title")}
          </h1>

          <p className="m-0 max-w-[34rem] text-[1.02rem] leading-[1.6] text-pretty text-[#eaf2ff] sm:text-[1.1rem]">
            {t("subtitle")}
          </p>

          <div className="mt-1 max-w-[40rem]">
            <LandingSearchCard />
          </div>

          <p className="m-0 flex items-start gap-2 text-[0.85rem] leading-snug text-[#eaf2ff]">
            <Check className="mt-px h-4 w-4 flex-none" aria-hidden />
            {t("note")}
          </p>
        </div>

        <figure className="absolute inset-0 -z-10 m-0 lg:relative lg:inset-auto lg:z-0 lg:aspect-[4/5] lg:overflow-hidden lg:rounded-[28px] lg:shadow-[0_40px_80px_-40px_rgba(2,12,32,0.7)] lg:ring-1 lg:ring-[rgb(255_255_255/0.18)]">
          <Image
            src={image.src}
            width={image.width}
            height={image.height}
            alt={tImages(image.alt)}
            priority
            sizes="(min-width: 1024px) 520px, 100vw"
            className="h-full w-full object-cover"
          />
          <div aria-hidden className={`${styles.shade} absolute inset-0`} />
        </figure>
      </div>
    </section>
  );
}
