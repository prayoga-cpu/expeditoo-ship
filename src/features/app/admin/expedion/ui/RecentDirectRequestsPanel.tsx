"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Inbox, MapPin } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import type { AdminListing } from "@/features/app/admin/hooks/useAdminListings";
import { STATUS_TONE } from "@/features/app/listing/statusTone";
import { formatCurrency } from "@/lib/currency";

interface RecentDirectRequestsPanelProps {
  rows: AdminListing[];
  /** Every direct request, not just the rows shown. */
  total: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * The newest requests posted at `/create`, beside the Expedion quotes.
 *
 * Supervision read `expedion_quotes` alone, so a request posted on Expeditoo
 * itself (a `listings` row with `origin = 'direct'`) never showed on the page
 * an admin lands on. The client asked whether the panel was "only the Airtable
 * import", and it was (request_summary_spec.md §3.2).
 *
 * Takes its rows as props, like `RecentQuotesPanel`, so it renders the same
 * whether the data came from a live query or a test.
 */
export function RecentDirectRequestsPanel({
  rows,
  total,
  isLoading,
  isError,
}: RecentDirectRequestsPanelProps) {
  const t = useTranslations("admin.expedion.directRequests");

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            {t("title")}
            {!isLoading && !isError && (
              <Badge variant="secondary">{t("total", { count: total })}</Badge>
            )}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/admin/listings">{t("viewAll")}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("loading")}
          </p>
        ) : isError ? (
          <CenteredEmptyState icon={AlertTriangle} title={t("error")} />
        ) : rows.length === 0 ? (
          <CenteredEmptyState
            icon={Inbox}
            title={t("empty")}
            description={t("emptyBody")}
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <DirectRequestRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DirectRequestRow({ row }: { row: AdminListing }) {
  const t = useTranslations("admin.expedion.directRequests");
  const tStatus = useTranslations("myJobs.status");
  const format = useFormatter();

  return (
    <li>
      <Link
        href={`/admin/listings?id=${encodeURIComponent(row.id)}`}
        className="-mx-3 flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium wrap-break-word">{row.title}</span>
            <Badge variant="outline" className={STATUS_TONE[row.status]}>
              {tStatus(row.status)}
            </Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {row.pickupCity} → {row.dropoffCity}
            </span>
            <span>{t("requester", { name: row.shipper.name })}</span>
            <span>
              {format.dateTime(new Date(row.createdAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </p>
        </div>
        <span className="shrink-0 font-mono font-semibold">
          {formatCurrency(row.budgetCents)}
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </Link>
    </li>
  );
}
