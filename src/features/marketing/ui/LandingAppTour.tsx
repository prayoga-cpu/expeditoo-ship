"use client";

import Image from "next/image";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./LandingSectionHeading";
import { H_CONTAINER, H_SECTION_Y, LP_ANCHOR_OFFSET } from "./styles";

/**
 * « Dans l'application » (2.98.0, docs/specs/landing_app_tour_spec.md): one
 * transport followed from the request to the payout, on the app's own
 * screens. Each step names whose screen it is — the requester's, the
 * carrier's, the team's.
 *
 * The pictures are screenshots of the running app signed in to the demo
 * accounts `pnpm db:seed:demo` creates, so every name, address and amount in
 * them is fictional. They are re-taken with `scripts/capture-app-tour.mjs`;
 * a step added here needs its four files (desktop and phone, fr and en) or
 * `LandingAppTour.test.tsx` fails.
 */
export const TOUR_STEPS = [
  { key: "request", role: "requester", path: "/create" },
  { key: "board", role: "carrier", path: "/expedion" },
  { key: "choose", role: "requester", path: "/listing" },
  { key: "messages", role: "both", path: "/messages" },
  { key: "run", role: "carrier", path: "/driver/shipments" },
  { key: "track", role: "requester", path: "/deliveries" },
  { key: "money", role: "carrier", path: "/carrier/withdrawals" },
  { key: "team", role: "staff", path: "/admin/drivers" },
] as const;

type TourStep = (typeof TOUR_STEPS)[number];

export const TOUR_DESKTOP = { width: 1280, height: 800 } as const;
export const TOUR_PHONE = { width: 780, height: 1560 } as const;

export function tourImage(key: TourStep["key"], device: "desktop" | "phone", locale: string): string {
  const lang = locale === "fr" ? "fr" : "en";
  return `/images/landing/app/${key}-${device}-${lang}.webp`;
}

const NEXT_KEY: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

const FOCUS_RING =
  "focus-visible:ring-[3px] focus-visible:ring-[rgb(7_107_227/0.35)] focus-visible:outline-none";

function number(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function StepTabs({
  active,
  onSelect,
  ids,
}: {
  active: number;
  onSelect: (index: number) => void;
  ids: (i: number) => { tab: string; panel: string };
}) {
  const t = useTranslations("marketing.tour");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = NEXT_KEY[event.key];
    if (!next) return;
    event.preventDefault();
    const index = next(active, TOUR_STEPS.length);
    onSelect(index);
    tabs.current[index]?.focus();
    // On a phone the tabs are a sideways strip: keep the chosen one in view.
    tabs.current[index]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  return (
    <div
      role="tablist"
      aria-label={t("tabsLabel")}
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
      className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-t lg:border-[var(--h-line2)] lg:px-0 lg:pb-0"
    >
      {TOUR_STEPS.map((step, index) => {
        const selected = index === active;
        return (
          <button
            key={step.key}
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
              "flex w-[13.5rem] flex-none cursor-pointer snap-start items-baseline gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors lg:w-auto lg:rounded-none lg:border-0 lg:border-b lg:border-[var(--h-line2)] lg:px-1 lg:py-4",
              FOCUS_RING,
              selected
                ? "border-[var(--h-accent)] bg-[var(--h-accent-soft)] lg:bg-transparent"
                : "border-[var(--h-line)] bg-[var(--h-card)] lg:bg-transparent"
            )}
          >
            <span
              className={cn(
                "font-mono text-[0.8rem] tabular-nums",
                selected ? "text-[var(--h-accent-text)]" : "text-[var(--h-muted)]"
              )}
            >
              {number(index)}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.74rem] font-semibold tracking-[0.02em] text-[var(--h-muted)]">
                {t(`roles.${step.role}`)}
              </span>
              <span
                className={cn(
                  "text-[0.98rem] leading-snug font-bold tracking-[-0.01em] lg:text-[1.08rem]",
                  selected ? "text-[var(--h-text)]" : "text-[var(--h-muted)]"
                )}
              >
                {t(`steps.${step.key}.title`)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The app's screen at desktop width, in a frame that says which page it is. */
function DesktopFrame({ step, src, alt }: { step: TourStep; src: string; alt: string }) {
  return (
    <div className="hidden overflow-hidden rounded-[14px] bg-[var(--h-card)] shadow-[var(--h-shadow)] ring-1 ring-[var(--h-line2)] md:block">
      <div className="flex h-8 items-center border-b border-[var(--h-line)] px-3.5 font-mono text-[0.7rem] text-[var(--h-muted)]">
        expeditop.fr{step.path}
      </div>
      <Image
        src={src}
        alt={alt}
        width={TOUR_DESKTOP.width}
        height={TOUR_DESKTOP.height}
        sizes="(min-width: 1024px) 660px, 90vw"
        className="block h-auto w-full"
      />
    </div>
  );
}

/** The same step on a phone. From `md` it overlaps the desktop frame's corner. */
function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto w-[15rem] overflow-hidden rounded-[30px] bg-[#0c1220] p-[7px] shadow-[var(--h-shadow)] ring-1 ring-[rgb(255_255_255/0.16)] md:absolute md:right-3 md:-bottom-10 md:mx-0 md:w-[10.5rem] lg:-right-4 lg:w-[11.5rem]">
      <Image
        src={src}
        alt={alt}
        width={TOUR_PHONE.width}
        height={TOUR_PHONE.height}
        sizes="240px"
        className="block h-auto w-full rounded-[23px]"
      />
    </div>
  );
}

function StepPanel({
  step,
  index,
  id,
  tabId,
  hidden,
}: {
  step: TourStep;
  index: number;
  id: string;
  tabId: string;
  hidden: boolean;
}) {
  const t = useTranslations("marketing.tour");
  const locale = useLocale();
  const title = t(`steps.${step.key}.title`);

  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={tabId}
      hidden={hidden}
      tabIndex={0}
      className={cn("flex-col gap-7 rounded-2xl", FOCUS_RING, hidden ? "hidden" : "flex")}
    >
      <div className="flex max-w-[36rem] flex-col gap-2">
        <h3 className="m-0 text-[1.35rem] leading-tight font-extrabold tracking-[-0.025em] text-[var(--h-text)] sm:text-[1.6rem]">
          <span className="sr-only">{number(index)}. </span>
          {title}
        </h3>
        <p className="m-0 text-[1rem] leading-[1.65] text-pretty text-[var(--h-muted)]">
          {t(`steps.${step.key}.desc`)}
        </p>
      </div>
      {/* Only the open step's pictures are in the document, so a visitor
          downloads two files, not sixteen. */}
      {!hidden && (
        <div className="relative md:pb-10">
          <DesktopFrame step={step} src={tourImage(step.key, "desktop", locale)} alt={t("altDesktop", { step: title })} />
          <PhoneFrame src={tourImage(step.key, "phone", locale)} alt={t("altPhone", { step: title })} />
        </div>
      )}
    </div>
  );
}

export function LandingAppTour() {
  const t = useTranslations("marketing.tour");
  const [active, setActive] = useState(0);
  const base = useId();
  const ids = (index: number) => ({ tab: `${base}-tab-${index}`, panel: `${base}-panel-${index}` });

  return (
    <section id="app" aria-labelledby="tour-title" className={`${LP_ANCHOR_OFFSET} ${H_SECTION_Y} bg-[var(--h-alt)]`}>
      <div className={`${H_CONTAINER} flex flex-col gap-10 lg:gap-14`}>
        <SectionHeading titleId="tour-title" eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />
        <div data-reveal className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-start lg:gap-14">
          <StepTabs active={active} onSelect={setActive} ids={ids} />
          <div className="min-w-0">
            {TOUR_STEPS.map((step, index) => (
              <StepPanel
                key={step.key}
                step={step}
                index={index}
                id={ids(index).panel}
                tabId={ids(index).tab}
                hidden={index !== active}
              />
            ))}
          </div>
        </div>
        <p className="m-0 text-[0.85rem] text-[var(--h-muted)]">{t("demoNote")}</p>
      </div>
    </section>
  );
}
