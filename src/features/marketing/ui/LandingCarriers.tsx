"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { LandingGatedButton } from "./LandingGatedButton";
import { LANDING_IMAGES } from "./landing-images";
import { Eyebrow, revealDelay } from "./LandingSectionHeading";
import { H_BTN_WHITE, H_CONTAINER, H_SECTION_Y, LP_ANCHOR_OFFSET } from "./styles";
import styles from "./landing.module.css";

/**
 * What a carrier gets, each line something the app does: they bid their own
 * price on open requests; declared trajets filter the board to their road
 * (`carrier_trips_spec.md`); approval is by a person, before the first offer
 * (`driver_types_spec.md` §3.1); a delivery credits their balance and an
 * operator transfers a withdrawal by hand — so no delay and no « automatic »
 * is promised (`payout_safety_spec.md`, `payout-claims.test.ts`).
 */
const POINTS = ["point1", "point2", "point3", "point4"] as const;

function CarrierPhoto() {
  const tImages = useTranslations("marketing.images");
  const photo = LANDING_IMAGES.carrier;
  return (
    <div data-reveal className="relative aspect-[4/3] overflow-hidden rounded-[28px] ring-1 ring-[rgb(255_255_255/0.12)] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]">
      <Image
        src={photo.src}
        width={photo.width}
        height={photo.height}
        alt={tImages(photo.alt)}
        sizes="(min-width: 1024px) 560px, 100vw"
        className={`${styles.drift} h-full w-full object-cover`}
      />
    </div>
  );
}

function CarrierPoints() {
  const t = useTranslations("marketing.carriers");
  return (
    <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
      {POINTS.map((key, index) => (
        <li key={key} data-reveal style={revealDelay(index + 1)} className="flex items-start gap-3 text-[0.98rem] leading-snug text-[#eef3fb]">
          <span aria-hidden className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[rgb(91_157_255/0.18)] text-[#8fb8ff]">
            <Check className="h-3.5 w-3.5" />
          </span>
          {t(key)}
        </li>
      ))}
    </ul>
  );
}

/**
 * « Vous transportez ? » — the reference's dark statement band, in our navy
 * (docs/specs/landing_2026_11_spec.md §3). The button keeps the gated flow
 * the header uses, and a session turns it into « Ouvrir votre profil »
 * (landing_gated_actions_spec.md §6).
 */
export function LandingCarriers() {
  const t = useTranslations("marketing.carriers");
  const tCta = useTranslations("marketing.cta");
  const { isAuthenticated } = useAuth();

  return (
    <section
      id="carriers"
      aria-labelledby="carriers-title"
      className={`${LP_ANCHOR_OFFSET} ${H_SECTION_Y} relative isolate overflow-hidden bg-[var(--h-navy)] text-white`}
    >
      <div aria-hidden className="absolute -top-40 -left-40 -z-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(7_107_227/0.35),rgb(7_107_227/0))]" />
      <div className={`${H_CONTAINER} grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16`}>
        <div data-reveal className="flex flex-col items-start gap-6">
          <Eyebrow onDark>{t("eyebrow")}</Eyebrow>
          <h2
            id="carriers-title"
            className="m-0 text-[2rem] leading-[1.06] font-extrabold tracking-[-0.035em] text-balance text-white sm:text-[2.6rem] lg:text-[3.25rem]"
          >
            {t("title")}
          </h2>
          <p className="m-0 max-w-[34rem] text-[1.05rem] leading-relaxed text-pretty text-[#c6d3e8]">{t("intro")}</p>
          <CarrierPoints />
          <LandingGatedButton
            intent="carrier"
            label={isAuthenticated ? tCta("primaryAuthed") : tCta("primary")}
            className={`${H_BTN_WHITE} mt-3`}
          />
        </div>
        <CarrierPhoto />
      </div>
    </section>
  );
}
