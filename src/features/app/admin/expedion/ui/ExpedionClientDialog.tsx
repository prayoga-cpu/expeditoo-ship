"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AlertCircle, Mail, MapPin, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/page-loader";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

import type { ExpedionClientQuote } from "../api/clients.api";
import { useExpedionClient } from "../hooks/useExpedionClients";

/** Where each status sits in the lifecycle, as colour. Tokens, so both themes work. */
const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  awaiting_confirmation: "bg-muted text-muted-foreground border-border",
  quoted: "bg-primary/15 text-primary border-primary/30",
  accepted: "bg-primary/15 text-primary border-primary/30",
  paid: "bg-warning/15 text-warning border-warning/30",
  assigned: "bg-warning/15 text-warning border-warning/30",
  escalated: "bg-warning/15 text-warning border-warning/30",
  picked_up: "bg-warning/15 text-warning border-warning/30",
  delivered: "bg-success/15 text-success border-success/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

/**
 * One Expedion client: who they are, and every quote they have filed.
 *
 * Read-only on purpose. Quotes are edited at /admin/expedion, which owns that
 * lifecycle — a second screen that could change one is how two surfaces come
 * to disagree about the same row.
 */
export function ExpedionClientDialog({
  ownerId,
  onOpenChange,
}: {
  ownerId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.expedionClients");
  const format = useFormatter();
  const { data, isLoading, isError } = useExpedionClient(ownerId);

  return (
    <Dialog open={Boolean(ownerId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {data?.client.name ?? t("detail.title")}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {ownerId}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <PageLoader />
        ) : isError || !data ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {t("detail.error")}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Fact icon={Mail} value={data.client.email} />
              <Fact icon={Phone} value={data.client.phone} />
              <Fact icon={MapPin} value={data.client.city} />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t("detail.quotes")} value={String(data.client.quoteCount)} />
              <Stat label={t("detail.paid")} value={String(data.client.paidCount)} />
              <Stat
                label={t("detail.delivered")}
                value={String(data.client.deliveredCount)}
              />
              <Stat
                label={t("detail.value")}
                value={formatCurrency(data.client.paidValueCents)}
              />
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                {t("detail.since", {
                  date: format.dateTime(new Date(data.client.firstSeenAt), {
                    dateStyle: "medium",
                  }),
                })}
              </p>
              {data.client.account ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("detail.hasAccount", { email: data.client.account.email })}
                  {data.client.account.banned && (
                    <Badge
                      variant="outline"
                      className="ml-2 border-destructive/30 bg-destructive/15 text-destructive"
                    >
                      {t("detail.accountSuspended")}
                    </Badge>
                  )}
                </p>
              ) : (
                // Said plainly, because it is the majority case and reads as
                // missing data otherwise.
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("detail.noAccountHint")}
                </p>
              )}
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t("detail.quotesTitle")}</h3>
              {data.quotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("detail.noQuotes")}
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {data.quotes.map((quote) => (
                    <QuoteLine key={quote.id} quote={quote} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Fact({
  icon: Icon,
  value,
}: {
  icon: typeof Mail;
  value: string | null;
}) {
  if (!value) return null;

  return (
    <p className="flex items-center gap-2 text-sm text-foreground">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-input p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-lg tabular-nums">{value}</p>
    </div>
  );
}

function QuoteLine({ quote }: { quote: ExpedionClientQuote }) {
  const t = useTranslations("admin.expedionClients");
  const format = useFormatter();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-foreground">
          {quote.bordereauNumber ?? quote.quoteNumber ?? quote.id}
        </p>
        <p className="text-xs text-muted-foreground">
          {[quote.pickupCity, quote.deliveryCity].filter(Boolean).join(" → ") ||
            "—"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            STATUS_TONE[quote.status] ?? "bg-muted text-muted-foreground border-border"
          )}
        >
          {t(`quoteStatus.${quote.status}`)}
        </Badge>
        {quote.acceptedPriceCents !== null && (
          <span className="font-mono tabular-nums">
            {formatCurrency(quote.acceptedPriceCents)}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {format.dateTime(new Date(quote.createdAt), { dateStyle: "medium" })}
        </span>
      </div>
    </li>
  );
}
