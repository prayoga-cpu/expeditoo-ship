"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { LandingGatedButton } from "./LandingGatedButton";
import { LANDING_IMAGES } from "./landing-images";
import { H_BTN_OUTLINE_WHITE, H_BTN_WHITE, H_CONTAINER, LP_ANCHOR_OFFSET } from "./styles";
import styles from "./landing.module.css";

/**
 * The closing call to action (docs/specs/landing_2026_11_spec.md §3), on a
 * photograph under the brand blue, as the reference closes on a picture
 * band: the requester's door first, the carrier's beside it. A session keeps
 * the requester's button — signed in, it is still how a request is posted —
 * and turns the carrier's into « Ouvrir votre profil ».
 */
export function LandingCTA() {
  const t = useTranslations("marketing.cta");
  const tImages = useTranslations("marketing.images");
  const { isAuthenticated } = useAuth();
  const photo = LANDING_IMAGES.closing;

  return (
    <section id="cta" aria-labelledby="cta-title" className={`${LP_ANCHOR_OFFSET} bg-[var(--h-bg)] pb-20 sm:pb-24 lg:pb-32`}>
      <div className={H_CONTAINER}>
        <div data-reveal className={`${styles.closing} relative isolate overflow-hidden rounded-[32px] text-white shadow-[var(--h-shadow)]`}>
          {/* The photograph fills the band on a phone, under a strong shade;
              from `lg` it is the right half, fading into the blue, so the
              van is seen and the words sit on solid colour. */}
          <div className="absolute inset-0 -z-10 lg:left-[42%]">
            <Image
              src={photo.src}
              width={photo.width}
              height={photo.height}
              alt={tImages(photo.alt)}
              sizes="(min-width: 1024px) 660px, 100vw"
              className="h-full w-full object-cover object-[35%_60%]"
            />
            <div aria-hidden className={`${styles.closingShade} absolute inset-0`} />
          </div>
          <div className="flex max-w-[42rem] flex-col items-start gap-8 px-6 py-14 sm:px-12 sm:py-20 lg:px-16 lg:py-24">
            <div className="flex flex-col gap-4">
              <h2
                id="cta-title"
                className="m-0 text-[2rem] leading-[1.06] font-extrabold tracking-[-0.035em] text-balance sm:text-[2.6rem] lg:text-[3.1rem]"
              >
                {t("title")}
              </h2>
              <p className="m-0 text-[1.05rem] leading-relaxed text-[#e4eeff]">
                {isAuthenticated ? t("subtitleAuthed") : t("subtitle")}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/create" className={H_BTN_WHITE}>
                {t("request")}
                <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
              </Link>
              <LandingGatedButton
                intent="carrier"
                label={isAuthenticated ? t("primaryAuthed") : t("primary")}
                className={H_BTN_OUTLINE_WHITE}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
