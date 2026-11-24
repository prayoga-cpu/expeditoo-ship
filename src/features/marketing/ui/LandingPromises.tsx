"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Camera, CreditCard, RotateCcw, ShieldCheck } from "lucide-react";
import { LANDING_IMAGES } from "./landing-images";
import { revealDelay, SectionHeading } from "./LandingSectionHeading";
import { H_CONTAINER, H_SECTION_Y, LP_ANCHOR_OFFSET } from "./styles";

/**
 * Four things that are true of every request (docs/specs/landing_2026_11_spec.md
 * §3). Each one is a rule the app enforces, not a promise of speed, price or
 * rating:
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

/** Three dashed rings round the photograph, the reference's orbit. */
function Rings() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      {[1.22, 1.5, 1.8].map((scale) => (
        <span
          key={scale}
          className="absolute top-1/2 left-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[var(--h-line2)]"
          style={{ width: `${scale * 100}%` }}
        />
      ))}
    </span>
  );
}

function Photo() {
  const tImages = useTranslations("marketing.images");
  const photo = LANDING_IMAGES.hero;
  return (
    <figure className="relative m-0 mx-auto mb-10 aspect-[16/10] w-full max-w-[560px] lg:absolute lg:inset-0 lg:m-auto lg:aspect-auto lg:h-[440px] lg:w-[352px]">
      <Rings />
      <Image
        src={photo.src}
        width={photo.width}
        height={photo.height}
        alt={tImages(photo.alt)}
        sizes="(min-width: 1024px) 352px, (min-width: 640px) 560px, 100vw"
        className="relative h-full w-full rounded-[30px] object-cover shadow-[var(--h-shadow)] ring-1 ring-[var(--h-line)]"
      />
    </figure>
  );
}

/**
 * « Nos engagements », in the manner of the reference's perks: four numbered
 * points around a central photograph from `lg` (1 and 2 above, 3 and 4
 * below — the reading order is the list's); photo first, then the points,
 * on a phone.
 */
export function LandingPromises() {
  const t = useTranslations("marketing.trust");

  return (
    <section id="promises" aria-labelledby="promises-title" className={`${LP_ANCHOR_OFFSET} ${H_SECTION_Y} overflow-hidden bg-[var(--h-bg)]`}>
      <div className={`${H_CONTAINER} flex flex-col gap-14 lg:gap-20`}>
        <SectionHeading titleId="promises-title" eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} centered />
        <div className="relative">
          <div data-reveal>
            <Photo />
          </div>
          <ol className="relative m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:min-h-[500px] lg:content-between lg:gap-x-[420px] lg:gap-y-0 xl:gap-x-[440px]">
            {ITEMS.map(({ key, icon: Icon }, index) => (
              <li
                key={key}
                data-reveal
                style={revealDelay(index, 110)}
                className="flex gap-4 rounded-[20px] bg-[var(--h-card)] p-5 shadow-[var(--h-shadow)] ring-1 ring-[var(--h-line)]"
              >
                <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-primary font-mono text-[0.85rem] font-semibold text-white">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2 text-[1.02rem] leading-snug font-bold text-[var(--h-text)]">
                    <Icon className="h-4 w-4 flex-none text-[var(--h-accent-text)]" aria-hidden />
                    {t(`${key}.title`)}
                  </span>
                  <span className="text-[0.9rem] leading-[1.55] text-[var(--h-muted)]">{t(`${key}.desc`)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
