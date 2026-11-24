"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Globe, House, Package, Sofa } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANDING_IMAGES } from "./landing-images";
import { SectionHeading } from "./LandingSectionHeading";
import { H_BTN_PRIMARY, H_CONTAINER, H_SECTION_Y, LP_ANCHOR_OFFSET } from "./styles";

/**
 * The four kinds of request `/create` takes. A move opens the form on its own
 * kind (`?type=moving`, 2.76.0); everything else starts on objects. Each
 * claim in the copy is something the form asks or the app does
 * (landing_2026_11_spec.md §3).
 */
export const SERVICES = [
  { key: "parcels", image: "parcel", icon: Package, href: "/create" },
  { key: "furniture", image: "shipper", icon: Sofa, href: "/create" },
  { key: "moving", image: "packing", icon: House, href: "/create?type=moving" },
  { key: "abroad", image: "europe", icon: Globe, href: "/create" },
] as const;

type Service = (typeof SERVICES)[number];

const NEXT_KEY: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

function ServicePanel({ service, id, tabId, hidden }: { service: Service; id: string; tabId: string; hidden: boolean }) {
  const t = useTranslations(`marketing.services.${service.key}`);
  const tImages = useTranslations("marketing.images");
  const photo = LANDING_IMAGES[service.image];
  const Icon = service.icon;

  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={tabId}
      hidden={hidden}
      tabIndex={0}
      className="grid grid-cols-1 items-center gap-8 rounded-[28px] focus-visible:ring-[3px] focus-visible:ring-[rgb(7_107_227/0.35)] focus-visible:outline-none lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[26px] bg-[var(--h-alt)] shadow-[var(--h-shadow)] ring-1 ring-[var(--h-line)]">
        <Image
          src={photo.src}
          width={photo.width}
          height={photo.height}
          alt={tImages(photo.alt)}
          sizes="(min-width: 1024px) 600px, 100vw"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-col items-start gap-5">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--h-accent-soft)] text-[var(--h-accent-text)]">
          <Icon className="h-6 w-6" />
        </span>
        <h3 className="m-0 text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em] text-[var(--h-text)] sm:text-[2rem]">
          {t("title")}
        </h3>
        <p className="m-0 max-w-[30rem] text-[1.02rem] leading-[1.7] text-pretty text-[var(--h-muted)]">{t("desc")}</p>
        <Link href={service.href} className={`${H_BTN_PRIMARY} mt-2`}>
          {t("cta")}
          <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function ServiceTabs({ active, onSelect, ids }: { active: number; onSelect: (index: number) => void; ids: (i: number) => { tab: string; panel: string } }) {
  const t = useTranslations("marketing.services");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = NEXT_KEY[event.key];
    if (!next) return;
    event.preventDefault();
    const index = next(active, SERVICES.length);
    onSelect(index);
    tabs.current[index]?.focus();
  }

  return (
    <div role="tablist" aria-label={t("tabsLabel")} onKeyDown={onKeyDown} className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-0 sm:border-b sm:border-[var(--h-line2)]">
      {SERVICES.map((service, index) => {
        const selected = index === active;
        return (
          <button
            key={service.key}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={ids(index).tab}
            aria-selected={selected}
            aria-controls={ids(index).panel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(index)}
            className={cn(
              "cursor-pointer rounded-xl border px-3 py-3 text-left text-[0.95rem] font-bold tracking-[-0.01em] transition-colors focus-visible:ring-[3px] focus-visible:ring-[rgb(7_107_227/0.35)] focus-visible:outline-none sm:-mb-px sm:rounded-none sm:border-0 sm:border-b-[3px] sm:bg-transparent sm:px-1 sm:pt-2 sm:pb-4 sm:text-[1.05rem]",
              selected
                ? "border-[var(--h-accent)] bg-[var(--h-accent-soft)] text-[var(--h-text)] sm:border-[var(--h-accent)]"
                : "border-[var(--h-line)] bg-[var(--h-card)] text-[var(--h-muted)] hover:text-[var(--h-text)] sm:border-transparent"
            )}
          >
            {t(`${service.key}.tab`)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * « Ce que nous transportons » (landing_2026_11_spec.md §3), in the manner of
 * the reference's services tabs: one tab per kind of request, each a
 * photograph, two true lines and the door into `/create`. WAI-ARIA tabs with
 * automatic activation — arrows, Home and End move and select.
 *
 * `#shippers`: the requester's section keeps the anchor it has always had.
 */
export function LandingServices() {
  const t = useTranslations("marketing.services");
  const [active, setActive] = useState(0);
  const base = useId();
  const ids = (index: number) => ({ tab: `${base}-tab-${index}`, panel: `${base}-panel-${index}` });

  return (
    <section id="shippers" aria-labelledby="services-title" className={`${LP_ANCHOR_OFFSET} ${H_SECTION_Y} bg-[var(--h-bg)]`}>
      <div className={`${H_CONTAINER} flex flex-col gap-12`}>
        <SectionHeading titleId="services-title" eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />
        <div data-reveal className="flex flex-col gap-10">
          <ServiceTabs active={active} onSelect={setActive} ids={ids} />
          {SERVICES.map((service, index) => (
            <ServicePanel key={service.key} service={service} id={ids(index).panel} tabId={ids(index).tab} hidden={index !== active} />
          ))}
        </div>
      </div>
    </section>
  );
}
