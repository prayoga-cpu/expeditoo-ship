"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { LandingGatedButton } from "./LandingGatedButton";
import { LANDING_IMAGES } from "./landing-images";
import { LP_ANCHOR_OFFSET } from "./styles";
import styles from "./landing.module.css";

const BUTTON =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[1rem] font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#076be3] focus-visible:outline-none";

/**
 * The closing call to action (docs/specs/landing_2026_11_spec.md §3): the
 * requester's door first, the carrier's beside it. A session keeps the
 * requester's button — signed in, it is still how a request is posted — and
 * turns the carrier's into « Ouvrir votre profil ».
 */
export function LandingCTA() {
  const t = useTranslations("marketing.cta");
  const tImages = useTranslations("marketing.images");
  const { isAuthenticated } = useAuth();
  const photo = LANDING_IMAGES.packing;

  return (
    <section id="cta" className={`${LP_ANCHOR_OFFSET} bg-background py-16 lg:py-24`}>
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-8">
        <div
          className={`${styles.closing} grid w-full grid-cols-1 overflow-hidden rounded-[28px] text-white lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]`}
        >
          <div className="flex flex-col items-start justify-center gap-8 px-6 py-10 sm:px-12 sm:py-14">
            <div className="flex max-w-[36rem] flex-col gap-3">
              <h2 className="m-0 text-[1.75rem] leading-tight font-bold tracking-[-0.02em] text-balance sm:text-[2.1rem]">
                {t("title")}
              </h2>
              <p className="m-0 text-[1.02rem] leading-relaxed text-[#eaf2ff]">
                {isAuthenticated ? t("subtitleAuthed") : t("subtitle")}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/create" className={`${BUTTON} bg-white text-[#0b4fb0] hover:bg-[#eaf2ff]`}>
                {t("request")}
                <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
              </Link>
              <LandingGatedButton
                intent="carrier"
                label={isAuthenticated ? t("primaryAuthed") : t("primary")}
                className={`${BUTTON} border border-[rgb(255_255_255/0.55)] bg-transparent text-white hover:bg-[rgb(255_255_255/0.12)]`}
              />
            </div>
          </div>

          {/* From `lg` only: on a phone the band is the message and two
              buttons, and a hidden lazy image is never fetched. */}
          <div className="relative hidden min-h-[320px] lg:block">
            <Image
              src={photo.src}
              width={photo.width}
              height={photo.height}
              alt={tImages(photo.alt)}
              sizes="460px"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
