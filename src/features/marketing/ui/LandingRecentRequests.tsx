"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarDays, House, Inbox, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { countryName, DEFAULT_COUNTRY } from "@/lib/countries";
import { formatListingReference } from "@/lib/listing-reference";
import type { RecentRequest } from "@/server/dto/recent-requests.dto";
import { titleAsSentence, townAsName } from "../display-text";
import { useRecentRequests } from "../hooks/useRecentRequests";
import { SectionHeading } from "./LandingSectionHeading";
import { H_CONTAINER, H_SECTION_Y, LP_ANCHOR_OFFSET } from "./styles";

/** Requests are in France first: a date is the day it is there. */
const TIME_ZONE = "Europe/Paris";

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(iso));
}

/** `YYYY-MM`: two days in one month print the month once (« du 12 au 26 nov. »). */
const monthKey = (iso: string) => dayKey(iso).slice(0, 7);

function useCardText() {
  const t = useTranslations("marketing.recent");
  const locale = useLocale();
  const day = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE,
  });
  const dayOnly = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: TIME_ZONE });
  const sameMonthFirst = locale.startsWith("fr");
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  const town = (city: string, country: string) => {
    const name = townAsName(city, locale);
    return country === DEFAULT_COUNTRY ? name : `${name} (${countryName(country, locale)})`;
  };
  const title = (text: string) => titleAsSentence(text, locale);

  const pickup = (item: RecentRequest) =>
    dayKey(item.pickupFrom) === dayKey(item.pickupUntil)
      ? t("pickupOn", { date: day.format(new Date(item.pickupFrom)) })
      : t("pickupBetween", {
          // French puts the day first, so a shared month is printed once
          // (« du 12 au 26 nov. »); English would read « 12 – Nov 26 ».
          from: (sameMonthFirst && monthKey(item.pickupFrom) === monthKey(item.pickupUntil)
            ? dayOnly
            : day
          ).format(new Date(item.pickupFrom)),
          to: day.format(new Date(item.pickupUntil)),
        });

  const size = (item: RecentRequest) => {
    if (item.jobKind === "items") return t("weight", { kg: number.format(item.weightKg) });
    if (item.movingSurfaceM2) return t("surface", { m2: number.format(item.movingSurfaceM2) });
    if (item.movingVolumeM3) return t("volume", { m3: number.format(item.movingVolumeM3) });
    return null;
  };

  return { t, town, title, pickup, size };
}

const CARD =
  "rounded-[22px] border border-[var(--h-line)] bg-[var(--h-card)]";

/** Pickup above, delivery below, joined by a dotted line: the trajet at a glance. */
function Route({ from, to, toLabel }: { from: string; to: string; toLabel: string }) {
  return (
    <div className="flex items-stretch gap-3">
      <span aria-hidden className="flex flex-col items-center py-[0.45rem]">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-[var(--h-accent)] bg-[var(--h-card)]" />
        <span className="my-1 w-0 flex-1 border-l-2 border-dotted border-[var(--h-line2)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--h-accent)]" />
      </span>
      <p className="m-0 flex min-w-0 flex-col gap-2.5 text-[0.95rem] leading-snug font-semibold text-[var(--h-text)]">
        <span>{from}</span>
        <span className="sr-only">{toLabel}</span>
        <span>{to}</span>
      </p>
    </div>
  );
}

function RequestCard({ item }: { item: RecentRequest }) {
  const { t, town, title, pickup, size } = useCardText();
  const Icon = item.jobKind === "moving" ? House : Package;
  const sized = size(item);

  return (
    <li
      className={`${CARD} group relative flex h-full flex-col gap-5 p-6 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:border-[#9cc0f4] hover:shadow-[var(--h-shadow)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:hover:border-[#2f5a96]`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--h-accent-soft)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--h-accent-text)]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {t(`kind.${item.jobKind}`)}
        </span>
        <span className="font-mono text-[0.75rem] text-[var(--h-muted)]">
          {t("reference", { reference: formatListingReference(item.reference) })}
        </span>
      </div>

      <h3 className="m-0 line-clamp-2 text-[1.2rem] leading-snug font-bold tracking-[-0.015em] text-[var(--h-text)]">
        {/* The title is the link; the card is its hit area. One name per
            link, not the whole card read out. */}
        <Link
          href={`/listing/${item.id}`}
          className="rounded-sm text-[var(--h-text)] after:absolute after:inset-0 after:rounded-[22px] after:content-[''] focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-[rgb(7_107_227/0.45)]"
        >
          {title(item.title)}
        </Link>
      </h3>

      <Route
        from={town(item.pickupCity, item.pickupCountry)}
        to={town(item.dropoffCity, item.dropoffCountry)}
        toLabel={t("to")}
      />

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--h-line)] pt-4 text-[0.85rem] text-[var(--h-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" aria-hidden />
          {pickup(item)}
        </span>
        {sized && <span className="font-semibold text-[var(--h-text)]">{sized}</span>}
      </div>
    </li>
  );
}

const GRID = "grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3";

function CardsSkeleton() {
  return (
    <ul aria-hidden className={GRID}>
      {[0, 1, 2].map((n) => (
        <li key={n} className={`${CARD} flex flex-col gap-4 p-6`}>
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-12 w-3/5" />
          <Skeleton className="mt-3 h-4 w-full" />
        </li>
      ))}
    </ul>
  );
}

function RecentList() {
  const t = useTranslations("marketing.recent");
  const { data, isPending, isError, refetch } = useRecentRequests();

  if (isPending) return <CardsSkeleton />;

  if (isError) {
    return (
      <LoadErrorState
        onRetry={() => void refetch()}
        title={t("error")}
        back={{ href: "/create", label: t("empty.cta") }}
        className={CARD}
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <CenteredEmptyState
        icon={Inbox}
        title={t("empty.title")}
        description={t("empty.description")}
        className={`${CARD} border-dashed`}
      >
        <Button asChild>
          <Link href="/create">{t("empty.cta")}</Link>
        </Button>
      </CenteredEmptyState>
    );
  }

  return (
    <ul className={GRID}>
      {data.items.map((item) => (
        <RequestCard key={item.id} item={item} />
      ))}
    </ul>
  );
}

/**
 * « Demandes récentes » (docs/specs/landing_2026_11_spec.md §4): the newest
 * open requests, in the public projection — a town at each end, never a
 * street, a pin or a person. Each card opens the request's own page, which
 * projects again for whoever is looking. The client's reference has this
 * section; 2.97.0 restyled the cards, not what they say.
 */
export function LandingRecentRequests() {
  const t = useTranslations("marketing.recent");

  return (
    <section
      id="recent"
      aria-labelledby="recent-title"
      className={`${LP_ANCHOR_OFFSET} ${H_SECTION_Y} bg-[var(--h-alt)]`}
    >
      <div className={`${H_CONTAINER} flex flex-col gap-12`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            titleId="recent-title"
            eyebrow={t("eyebrow")}
            title={t("title")}
            intro={t("subtitle")}
          />
          <Link
            href="/expedion"
            data-reveal
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-[var(--h-line2)] bg-[var(--h-card)] px-5 text-[0.95rem] font-semibold text-[var(--h-text)] transition-colors hover:border-[#9cc0f4] focus-visible:ring-[3px] focus-visible:ring-[rgb(7_107_227/0.4)] focus-visible:outline-none"
          >
            {t("seeAll")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div data-reveal>
          <RecentList />
        </div>
      </div>
    </section>
  );
}
