"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Weight,
  CalendarClock,
  Gavel,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BoardJob } from "../types";

interface JobCardProps {
  job: BoardJob;
}

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);

/** Hours left to bid, or null once the window has closed. */
function hoursLeft(expiresAt: string): number | null {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return ms <= 0 ? null : Math.floor(ms / (60 * 60 * 1000));
}

/**
 * One transport job on the board.
 *
 * A driver scanning the board decides on four things - where, how heavy, when,
 * and what it pays - so those lead, and the description does not appear at all.
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
        <div className="flex items-start justify-between gap-4">
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
