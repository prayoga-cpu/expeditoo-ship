"use client";

import { AlertCircle, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * One KPI tile.
 *
 * The admin dashboard and the Expedion report had grown two near-identical
 * inline versions of this markup that were already drifting apart — different
 * title weights, one carrying a delta and the other a hint. This is the shape
 * `Dashboard.tsx` established, with both variants folded in.
 *
 * The value box keeps a fixed height so a row of tiles does not jolt as
 * loading, error and loaded states swap in.
 */

/** `+12.4%` / `-3.0%`, the delta form the dashboard has always used. */
export function formatChange(percentage: number): string {
  const sign = percentage >= 0 ? "+" : "";
  return `${sign}${percentage.toFixed(1)}%`;
}

export interface StatCardProps {
  label: string;
  /** Pre-formatted — currency and counts differ, so formatting stays with the caller. */
  value: string;
  icon: LucideIcon;
  /** Quiet line under the value. Mutually exclusive with [change] in practice. */
  hint?: string;
  /** Percentage change; rendered through [formatChange] with [changeLabel]. */
  change?: number;
  /** e.g. "from last month" — the sentence the change sits in. */
  changeLabel?: string;
  /** A caveat worth showing but not emphasising, e.g. "*before Stripe fees". */
  footnote?: string;
  loading?: boolean;
  /** Shown instead of the value when the query failed. */
  errorText?: string;
  /** Colours the value — for a queue count that means "someone must act". */
  tone?: "default" | "warning" | "danger";
}

const TONE: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "",
  warning: "text-amber-600 dark:text-amber-500",
  danger: "text-destructive",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  change,
  changeLabel,
  footnote,
  loading = false,
  errorText,
  tone = "default",
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="flex h-[60px] flex-col justify-center">
          {errorText ? (
            <div className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{errorText}</span>
            </div>
          ) : loading ? (
            <>
              <Skeleton className="h-7 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </>
          ) : (
            <>
              <div className={`text-2xl font-bold ${TONE[tone]}`}>{value}</div>
              {change !== undefined && changeLabel ? (
                <p className="text-muted-foreground text-xs">
                  {formatChange(change)} {changeLabel}
                </p>
              ) : hint ? (
                <p className="text-muted-foreground text-xs">{hint}</p>
              ) : null}
              {footnote ? (
                <p className="text-muted-foreground/70 mt-1 text-[10px]">
                  {footnote}
                </p>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
