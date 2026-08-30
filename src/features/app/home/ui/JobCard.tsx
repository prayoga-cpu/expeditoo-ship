"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Weight,
  CalendarClock,
  Gavel,
  CheckCircle2,
  AlertTriangle,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { BoardJob } from "../types";

interface JobCardProps {
  job: BoardJob;
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
export function JobCard({ job }: JobCardProps) {
  const remaining = hoursLeft(job.expiresAt);
  const closingSoon = remaining !== null && remaining < 6;

  return (
    <Link href={`/listing/${job.id}`} className="block group">
      <Card
        className={cn(
          "p-4 transition-colors duration-200",
          "hover:border-primary/40 group-focus-visible:border-primary"
        )}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <JobThumbnail url={leadPhotoUrl(job.photos)} title={job.title} />

          <div className="min-w-0 flex-1">
            {/* Route first: it is what decides whether the job is worth reading */}
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="truncate">{job.pickupCity}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{job.dropoffCity}</span>
            </div>

            <h3 className="mt-1 truncate text-base font-semibold">{job.title}</h3>

            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Weight className="h-3.5 w-3.5" />
                <dd className="font-mono">{job.weightKg} kg</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                <dd>{format(new Date(job.pickupFrom), "d MMM")}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Gavel className="h-3.5 w-3.5" />
                <dd className="font-mono">
                  {job.offersCount} {job.offersCount === 1 ? "offer" : "offers"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="shrink-0 text-right">
            <p className="font-mono text-lg font-semibold tabular-nums">
              {euros(job.budgetCents)}
            </p>
            <p className="text-xs text-muted-foreground">budget</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {job.hasBid && (
            <Badge className="border-success/30 bg-success/15 text-success">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              You bid
            </Badge>
          )}
          {closingSoon && (
            <Badge className="border-warning/30 bg-warning/15 text-warning">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Closes in {remaining}h
            </Badge>
          )}
          {job.origin === "expedion" && (
            <Badge variant="secondary">via Expedion</Badge>
          )}
          {job.isFragile && <Badge variant="outline">Fragile</Badge>}
          {job.needsHelp && <Badge variant="outline">Help loading</Badge>}
          {job.category && (
            <Badge variant="outline" className="ml-auto">
              {job.category.name}
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}
