"use client";

import { useState } from "react";
import Link from "next/link";
import { format, isSameDay } from "date-fns";
import type { Locale } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Gavel,
  MapPin,
  Package,
  Weight,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { enUS, fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { cargoSizeLabel } from "@/lib/cargo-size";
import { nearestReferenceCity } from "@/lib/french-cities";
import type { BoardJob } from "../types";

interface JobCardProps {
  job: BoardJob;
  /** True while the matching map pin is hovered, so the pair reads as one. */
  isHighlighted?: boolean;
}

const euros = (cents: number) => formatCurrency(cents, { fractionDigits: 0 });

/** Hours left to bid, or null once the window has closed. */
function hoursLeft(expiresAt: string): number | null {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return ms <= 0 ? null : Math.floor(ms / (60 * 60 * 1000));
}

/**
 * The photo to lead with: the lowest `order`, which is the position the
 * requester uploaded it at.
 *
 * `photosInOrder` in `listings.dal.ts` already sorts the relation, so this is
 * belt and braces. It is worth the line because the failure it guards is
 * silent — the card would simply show a different photo of the same job on
 * every load, and nothing would report it.
 */
function leadPhotoUrl(photos: BoardJob["photos"]): string | undefined {
  if (!photos?.length) return undefined;
  return photos.reduce((lead, p) => (p.order < lead.order ? p : lead)).url;
}

/**
 * The job's lead photo, or a placeholder standing in its place.
 *
 * The slot is drawn either way, so a board mixing jobs that have a photo with
 * jobs that do not keeps one left edge rather than two.
 *
 * A photo that fails to load falls back to the same placeholder, which is not
 * mere defensiveness: a job escalated from Expedion carries the quote's
 * `photoUrls`, and a photo uploaded since the R2 move is an
 * `/api/expedion/files/<id>` URL that only the quote's owner or an admin may
 * read (`src/app/api/expedion/files/[id]/route.ts`). A driver's browser gets a
 * 404 for those, and this is what keeps a broken-image icon off the card.
 */
function JobThumbnail({ url, title }: { url?: string; title: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:h-20 sm:w-20">
      {url && !failed ? (
        <img
          src={url}
          alt={title}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Package className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

/**
 * One transport job on the board.
 *
 * A driver scanning the board decides on four things - where, how heavy, when,
 * and what it pays - so those lead, and the description does not appear at all.
 * The photo comes before all of them: it is what tells a driver at a glance
 * whether "Chaise" is a dining chair or an armchair, and the answer decides
 * whether the rest is worth reading.
 */
export function JobCard({ job, isHighlighted = false }: JobCardProps) {
  const t = useTranslations("jobBoard.card");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  const remaining = hoursLeft(job.expiresAt);
  const closingSoon = remaining !== null && remaining < 6;

  const size = cargoSizeLabel(job);
  const pickupWindow = describeWindow(
    job.pickupFrom,
    job.pickupUntil,
    dateLocale,
    t
  );

  return (
    <Link href={`/listing/${job.id}`} className="group block">
      <Card
        className={cn(
          "p-4 transition-colors duration-200",
          "hover:border-primary/40 group-focus-visible:border-primary",
          isHighlighted && "border-primary"
        )}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <JobThumbnail url={leadPhotoUrl(job.photos)} title={job.title} />

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold">{job.title}</h3>

            {/*
              Both ends, each on its own line and placed against a city the
              driver knows. A commune name alone is unreadable: France has
              ~35,000 of them and "Riom" only means something as "12 km from
              Clermont-Ferrand".
            */}
            <div className="mt-2 space-y-1.5">
              <Endpoint
                city={job.pickupCity}
                postalCode={job.pickupPostalCode}
                lat={job.pickupLat}
                lng={job.pickupLng}
                icon={<CircleDot className="h-3.5 w-3.5" />}
              />
              <Endpoint
                city={job.dropoffCity}
                postalCode={job.dropoffPostalCode}
                lat={job.dropoffLat}
                lng={job.dropoffLng}
                icon={<MapPin className="h-3.5 w-3.5" />}
              />
            </div>

            <dl className="text-muted-foreground mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <div className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                <dd>{pickupWindow}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Weight className="h-3.5 w-3.5 shrink-0" />
                <dd className="font-mono">{job.weightKg} kg</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Gavel className="h-3.5 w-3.5 shrink-0" />
                <dd className="font-mono">
                  {job.offersCount === 1
                    ? t("offersOne", { count: job.offersCount })
                    : t("offers", { count: job.offersCount })}
                </dd>
              </div>
            </dl>
          </div>

          <div className="shrink-0 text-right">
            <p className="font-mono text-lg font-semibold tabular-nums">
              {euros(job.budgetCents)}
            </p>
            <p className="text-muted-foreground text-xs">{t("budget")}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {job.hasBid && (
            <Badge className="border-success/30 bg-success/15 text-success">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {t("youBid")}
            </Badge>
          )}
          {closingSoon && (
            <Badge className="border-warning/30 bg-warning/15 text-warning">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {t("urgent")}
            </Badge>
          )}
          {job.origin === "expedion" && (
            <Badge variant="secondary">{t("viaExpedion")}</Badge>
          )}
          {job.isFragile && <Badge variant="outline">{t("fragile")}</Badge>}
          {job.needsHelp && <Badge variant="outline">{t("needsHelp")}</Badge>}

          {/*
            Size sits where the price does — hard right — because the two
            together are what a driver matches against their van.
          */}
          {size && (
            <Badge
              variant="outline"
              title={t("sizeTitle", { size: size.toUpperCase() })}
              className="ml-auto font-mono"
            >
              {size.toUpperCase()}
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}

/**
 * "Entre le 26 août et le 9 sept.", or "Le 2 sept." when the job can only
 * happen on one day.
 *
 * The board used to print `pickupFrom` alone, which said "2 Sep" for a job
 * collectable across a fortnight — the precise-looking half of a vague answer.
 */
function describeWindow(
  from: string,
  until: string,
  dateLocale: Locale,
  t: ReturnType<typeof useTranslations<"jobBoard.card">>
): string {
  const start = new Date(from);
  const end = new Date(until);
  const day = (date: Date) => format(date, "d MMM", { locale: dateLocale });

  return isSameDay(start, end)
    ? t("dateOne", { date: day(start) })
    : t("dateRange", { from: day(start), to: day(end) });
}

/**
 * One end of the job: the commune with its postcode, and the well-known city
 * it sits near. The second line is dropped when the commune *is* the landmark,
 * or when nothing well-known is close enough to help.
 */
function Endpoint({
  city,
  postalCode,
  lat,
  lng,
  icon,
}: {
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
  icon: React.ReactNode;
}) {
  const t = useTranslations("jobBoard.card");
  const bearing = nearestReferenceCity({ lat, lng }, city);

  return (
    <div className="flex items-start gap-1.5 text-sm">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="truncate font-medium">
          {city}{" "}
          <span className="text-muted-foreground font-mono text-xs">
            ({postalCode})
          </span>
        </p>
        {bearing && (
          <p className="text-muted-foreground truncate text-xs">
            {t("nearCity", { km: bearing.km, city: bearing.city })}
          </p>
        )}
      </div>
    </div>
  );
}
