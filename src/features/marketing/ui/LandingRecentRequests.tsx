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
import { LP_ANCHOR_OFFSET } from "./styles";

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

function RequestCard({ item }: { item: RecentRequest }) {
  const { t, town, title, pickup, size } = useCardText();
  const Icon = item.jobKind === "moving" ? House : Package;
  const sized = size(item);

  return (
    <li className="group relative flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow] hover:border-[#9cc0f4] hover:shadow-[0_18px_40px_-28px_rgba(7,40,90,0.45)] dark:hover:border-[#2f4a6e]">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf2fe] px-2.5 py-1 text-[0.75rem] font-semibold text-[#0b5bd0] dark:bg-[#11243d] dark:text-[#8fb8ff]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {t(`kind.${item.jobKind}`)}
        </span>
        <span className="font-mono text-[0.75rem] text-muted-foreground">
          {t("reference", { reference: formatListingReference(item.reference) })}
        </span>
      </div>

      <h3 className="m-0 line-clamp-2 text-[1.05rem] leading-snug font-semibold text-foreground">
        {/* The title is the link; the card is its hit area. One name per
            link, not the whole card read out. */}
        <Link
          href={`/listing/${item.id}`}
          className="rounded-sm text-foreground after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-[rgb(7_107_227/0.45)]"
        >
          {title(item.title)}
        </Link>
      </h3>

      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.92rem] font-medium text-foreground">
        <span>{town(item.pickupCity, item.pickupCountry)}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="sr-only">{t("to")}</span>
        <span>{town(item.dropoffCity, item.dropoffCountry)}</span>
      </p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3 text-[0.85rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" aria-hidden />
          {pickup(item)}
        </span>
        {sized && <span>{sized}</span>}
      </div>
    </li>
  );
}

function CardsSkeleton() {
  return (
    <ul aria-hidden className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((n) => (
        <li key={n} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
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
        className="rounded-2xl border border-border bg-card"
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <CenteredEmptyState
        icon={Inbox}
        title={t("empty.title")}
        description={t("empty.description")}
        className="rounded-2xl border border-dashed border-border bg-card"
      >
        <Button asChild>
          <Link href="/create">{t("empty.cta")}</Link>
        </Button>
      </CenteredEmptyState>
    );
  }

  return (
    <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
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
 * projects again for whoever is looking.
 */
export function LandingRecentRequests() {
  const t = useTranslations("marketing.recent");

  return (
    <section
      id="recent"
      aria-labelledby="recent-title"
      className={`${LP_ANCHOR_OFFSET} bg-[#f5f7fa] py-16 lg:py-24 dark:bg-[#0c1116]`}
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-[40rem] flex-col gap-2">
            <h2
              id="recent-title"
              className="m-0 text-[1.75rem] leading-tight font-bold tracking-[-0.02em] text-foreground sm:text-[2rem]"
            >
              {t("title")}
            </h2>
            <p className="m-0 text-[1rem] leading-relaxed text-muted-foreground">{t("subtitle")}</p>
          </div>
          <Link
            href="/expedion"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[0.9rem] font-semibold text-foreground transition-colors hover:border-[#9cc0f4] focus-visible:ring-[3px] focus-visible:ring-[rgb(7_107_227/0.4)] focus-visible:outline-none"
          >
            {t("seeAll")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <RecentList />
      </div>
    </section>
  );
}
