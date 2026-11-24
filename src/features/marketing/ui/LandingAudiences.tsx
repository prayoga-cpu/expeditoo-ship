"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { LandingGatedButton } from "./LandingGatedButton";
import { LANDING_IMAGES, type LandingImageKey } from "./landing-images";
import { LP_ANCHOR_OFFSET } from "./styles";

const BULLETS = ["point1", "point2", "point3"] as const;

const ACTION =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-[1rem] font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-[rgb(7_107_227/0.4)] focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto";

function AudienceCard({
  id,
  audience,
  image,
  action,
}: {
  id: string;
  audience: "shipper" | "carrier";
  image: LandingImageKey;
  action: ReactNode;
}) {
  const t = useTranslations(`marketing.audiences.${audience}`);
  const tImages = useTranslations("marketing.images");
  const photo = LANDING_IMAGES[image];

  return (
    <article
      id={id}
      aria-labelledby={`${id}-title`}
      className={`${LP_ANCHOR_OFFSET} flex flex-col overflow-hidden rounded-[24px] border border-border bg-card`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <Image
          src={photo.src}
          width={photo.width}
          height={photo.height}
          alt={tImages(photo.alt)}
          sizes="(min-width: 1024px) 560px, (min-width: 640px) 90vw, 100vw"
          className="h-full w-full object-cover"
        />
        <span className="absolute top-4 left-4 rounded-full bg-[rgb(255_255_255/0.92)] px-3 py-1 text-[0.8rem] font-semibold text-[#0f1722] shadow-sm dark:bg-[rgb(12_17_22/0.85)] dark:text-[#eef2f6]">
          {t("eyebrow")}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
        <h3
          id={`${id}-title`}
          className="m-0 text-[1.4rem] leading-tight font-bold tracking-[-0.015em] text-foreground sm:text-[1.6rem]"
        >
          {t("title")}
        </h3>
        <p className="m-0 text-[0.97rem] leading-[1.6] text-muted-foreground">{t("intro")}</p>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {BULLETS.map((key) => (
            <li key={key} className="flex items-start gap-2.5 text-[0.95rem] leading-snug text-foreground">
              <Check
                className="mt-0.5 h-[18px] w-[18px] flex-none text-[#0e8a5f] dark:text-[#2fbf87]"
                aria-hidden
              />
              {t(key)}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-2">{action}</div>
      </div>
    </article>
  );
}

/**
 * The two people this site is for (docs/specs/landing_2026_11_spec.md §3):
 * whoever needs something moved, and whoever moves it — in-house drivers and
 * outside professional carriers alike, all checked before their first offer.
 * The carrier's button keeps the gated flow the header uses, and a session
 * turns it into « Ouvrir votre profil » (landing_gated_actions_spec.md §6).
 */
export function LandingAudiences() {
  const t = useTranslations("marketing.audiences");
  const tCta = useTranslations("marketing.cta");
  const { isAuthenticated } = useAuth();

  return (
    <section
      aria-labelledby="audiences-title"
      className="bg-[#f5f7fa] py-16 lg:py-24 dark:bg-[#0c1116]"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 sm:px-8">
        <div className="flex max-w-[40rem] flex-col gap-2">
          <h2
            id="audiences-title"
            className="m-0 text-[1.75rem] leading-tight font-bold tracking-[-0.02em] text-foreground sm:text-[2.1rem]"
          >
            {t("title")}
          </h2>
          <p className="m-0 text-[1rem] leading-relaxed text-muted-foreground">{t("intro")}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AudienceCard
            id="shippers"
            audience="shipper"
            image="shipper"
            action={
              <Link href="/create" className={`${ACTION} bg-primary text-white hover:bg-[#055bc4]`}>
                {t("shipper.cta")}
                <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
              </Link>
            }
          />
          <AudienceCard
            id="carriers"
            audience="carrier"
            image="carrier"
            action={
              <LandingGatedButton
                intent="carrier"
                label={isAuthenticated ? tCta("primaryAuthed") : tCta("primary")}
                className={`${ACTION} border border-[#0f1722] bg-[#0f1722] text-white hover:bg-[#1e2a38] dark:border-[#eef2f6] dark:bg-[#eef2f6] dark:text-[#0f1722] dark:hover:bg-white`}
              />
            }
          />
        </div>
      </div>
    </section>
  );
}
