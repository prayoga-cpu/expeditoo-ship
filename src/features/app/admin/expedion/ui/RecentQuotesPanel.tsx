"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, MoreVertical, Send, Tag, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/features/app/admin/ui/data-table";
import { cn } from "@/lib/utils";
import type { QuoteRow } from "@/server/dal/expedion-report.dal";

import { AssignDriverDialog } from "./AssignDriverDialog";
import { EscalateDialog } from "./EscalateDialog";
import { QuoteDetailDialog } from "./QuoteDetailDialog";
import { RepriceDialog } from "./RepriceDialog";
import {
  byUrgency,
  isNewQuote,
  nextAction,
  storageDaysLeft,
  type QuoteAction,
  type QuoteActionKind,
  type QuoteDialog,
} from "../lib/quote-action";

/**
 * The recent quotes, as a worklist rather than a log.
 *
 * This sits at the top of the report because it is the only section that
 * answers "has anything arrived, and does it need me?" — the KPIs below say how
 * the business is doing, which is a different question and a slower one.
 *
 * Two views over the same rows: **To handle** (default when there is any) is
 * the work, most urgent first and oldest first within a kind; **All** is the
 * newest-first feed the section used to be. Every row states what it is waiting
 * for and offers exactly that action as its button, so an operator never has to
 * open a dropdown to find out whether there is anything to do.
 */

const NOT_ACTIONABLE_TONE = "text-muted-foreground";

/** Badge look per action, so the urgent ones read as urgent at a glance. */
const TONE: Record<QuoteActionKind, string> = {
  escalate: "bg-destructive text-white border-transparent",
  assign:
    "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  price: "bg-primary/15 text-primary border-primary/30",
  storage:
    "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  awaitingPayment: "bg-muted text-muted-foreground border-transparent",
  awaitingClient: "bg-muted text-muted-foreground border-transparent",
  inProgress: "bg-muted text-muted-foreground border-transparent",
  done: "bg-muted text-muted-foreground border-transparent",
  cancelled: "bg-muted text-muted-foreground border-transparent",
};

const DIALOG_ICON: Record<QuoteDialog, typeof Tag> = {
  reprice: Tag,
  assign: Truck,
  escalate: Send,
};

function money(cents: number | null): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * "3 days ago" in the operator's language.
 *
 * `Intl.RelativeTimeFormat` rather than message keys: the unit changes with the
 * value, and a plural rule per unit per locale is a translation file nobody
 * keeps correct.
 */
function ago(date: Date | null, locale: string, now: Date): string {
  if (!date) return "—";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round((date.getTime() - now.getTime()) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

/** The same instant spelled out, for the title on the relative label. */
function exact(date: Date | null, locale: string): string | undefined {
  if (!date) return undefined;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "medium",
  }).format(date);
}

export interface RecentQuotesPanelProps {
  rows: QuoteRow[];
  /** Title-only empty state, for when the section could not be read at all. */
  unavailable?: boolean;
}

export function RecentQuotesPanel({
  rows,
  unavailable = false,
}: RecentQuotesPanelProps) {
  const t = useTranslations("admin.expedion");
  const locale = useLocale();
  const [tab, setTab] = useState<"todo" | "all" | null>(null);
  const [reprice, setReprice] = useState<QuoteRow | null>(null);
  const [assign, setAssign] = useState<QuoteRow | null>(null);
  const [escalate, setEscalate] = useState<QuoteRow | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  // One `now` for the whole render, so the age column, the "new" dots and the
  // sort cannot each be computed against a slightly different clock.
  const now = useMemo(() => new Date(), [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const { todo, all, newCount } = useMemo(() => {
    const decorated = rows.map((row) => ({ row, action: nextAction(row) }));
    return {
      todo: decorated
        .filter((d) => d.action.actionable)
        .map((d) => d.row)
        .sort(byUrgency()),
      all: rows,
      newCount: rows.filter((row) => isNewQuote(row, now)).length,
    };
  }, [rows, now]);

  // Default to the work when there is any, and to the feed when there is not —
  // an empty "to handle" tab as the landing view reads as a broken page.
  const active = tab ?? (todo.length > 0 ? "todo" : "all");
  const data = active === "todo" ? todo : all;

  const openDialog = (quote: QuoteRow, dialog: QuoteDialog) => {
    if (dialog === "reprice") setReprice(quote);
    if (dialog === "assign") setAssign(quote);
    if (dialog === "escalate") setEscalate(quote);
  };

  const columns = useMemo<ColumnDef<QuoteRow>[]>(
    () => [
      {
        accessorKey: "reference",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.reference")} />
        ),
        cell: ({ row }) => (
          <div className="flex items-start gap-2">
            {isNewQuote(row.original, now) ? (
              <span
                className="bg-primary mt-1.5 h-2 w-2 shrink-0 rounded-full"
                aria-label={t("recent.new")}
                title={t("recent.new")}
              />
            ) : (
              <span className="mt-1.5 h-2 w-2 shrink-0" />
            )}
            <div className="min-w-0">
              {/* The id is what the client's own screen shows, so an operator
                  reading a row and a client reading their quote are naming the
                  same string. The quote number leads when there is one — it is
                  what Expedion prints — and the id sits under it either way. */}
              <div className="font-mono text-xs">
                {row.original.reference ?? row.original.id}
              </div>
              {row.original.reference ? (
                <div
                  className="text-muted-foreground/70 truncate font-mono text-[10px]"
                  title={row.original.id}
                >
                  {row.original.id}
                </div>
              ) : null}
              <div className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                <span className="truncate">
                  {row.original.auctionHouseName ?? "—"}
                </span>
                <ArrowRight className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {row.original.deliveryCity ?? "—"}
                </span>
              </div>
            </div>
          </div>
        ),
        // The toolbar searches this column, so it has to match everything the
        // row shows — the route and the client included.
        filterFn: (row, _id, value) => {
          const q = String(value).toLowerCase();
          return [
            row.original.reference,
            row.original.auctionHouseName,
            row.original.deliveryCity,
            row.original.clientName,
          ].some((field) => (field ?? "").toLowerCase().includes(q));
        },
      },
      {
        id: "client",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.client")} />
        ),
        // Name *and* address: an imported row usually has no name at all, and
        // the email is then the only way to reach whoever is waiting. The
        // "Airtable import" flag stays, because it is what tells the operator
        // there is no account behind this — but it no longer replaces the
        // contact details it used to hide.
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate">{row.original.clientName ?? "—"}</div>
            {row.original.clientEmail ? (
              <div
                className="text-muted-foreground truncate text-xs"
                title={row.original.clientEmail}
              >
                {row.original.clientEmail}
              </div>
            ) : null}
            {row.original.owned ? null : (
              <div className="text-xs text-amber-600 dark:text-amber-500">
                {t("table.airtableImport")}
              </div>
            )}
          </div>
        ),
        enableSorting: false,
      },
      {
        id: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.amount")} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {money(row.original.priceCents)}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: "waiting",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("recent.waiting")} />
        ),
        cell: ({ row }) => {
          const days = storageDaysLeft(row.original, now);
          const atRisk = row.original.queues.storageAtRisk && days !== null;
          return (
            <div className="flex flex-col items-start gap-1">
              <span
                className="text-muted-foreground cursor-help text-xs"
                title={exact(row.original.requestedAt, locale)}
              >
                {ago(row.original.requestedAt, locale, now)}
              </span>
              {atRisk ? (
                <Badge
                  variant={days <= 0 ? "destructive" : "secondary"}
                  className="text-[10px]"
                >
                  {days <= 0
                    ? t("table.billed")
                    : t("recent.storageIn", { count: days })}
                </Badge>
              ) : null}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: "action",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("recent.nextStep")}
          />
        ),
        cell: ({ row }) => {
          const action = nextAction(row.original);
          return (
            <Badge
              className={cn("border", TONE[action.kind])}
              variant="outline"
            >
              {action.blocked
                ? t("recent.action.escalateBlocked")
                : t(`recent.action.${action.kind}`)}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <RowActions
            quote={row.original}
            action={nextAction(row.original)}
            onOpen={openDialog}
          />
        ),
      },
    ],
    // `now` is stable for the life of a `rows` array; `t` and `locale` change
    // only with the language.
    [locale, now, t]
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">{t("recent.title")}</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            {/* The scope is stated because the tab counts are *of these rows*:
                the page's "to handle" KPI counts the whole table and is far
                larger, and two different numbers under the same words is how a
                dashboard loses an operator's trust. */}
            {t("recent.subtitle", { count: newCount, total: all.length })} ·{" "}
            {t("recent.openHint")}
          </p>
        </div>
        <div className="bg-muted flex w-fit items-center rounded-lg p-1">
          <TabButton
            active={active === "todo"}
            onClick={() => setTab("todo")}
            label={t("recent.tabs.todo")}
            count={todo.length}
            tone={todo.length > 0 ? "attention" : "muted"}
          />
          <TabButton
            active={active === "all"}
            onClick={() => setTab("all")}
            label={t("recent.tabs.all")}
            count={all.length}
            tone="muted"
          />
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-muted-foreground px-6 py-10 text-center">
            <p className="text-foreground text-sm font-medium">
              {unavailable
                ? t("error")
                : active === "todo"
                  ? t("recent.todoEmpty")
                  : t("recent.empty")}
            </p>
            {unavailable ? null : (
              <p className="mt-1 text-sm">
                {active === "todo"
                  ? t("recent.todoEmptyBody")
                  : t("recent.emptyBody")}
              </p>
            )}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={data}
            searchKey="reference"
            searchPlaceholder={t("table.searchPlaceholder")}
            tableMinHeight="auto"
            onRowClick={(row) => setDetail(row.id)}
          />
        )}
      </CardContent>

      {/* Mounted only while open: it fetches the whole quote on mount, and a
          detail view for a row nobody clicked is a request nobody asked for. */}
      {detail ? (
        <QuoteDetailDialog quoteId={detail} onClose={() => setDetail(null)} />
      ) : null}
      <RepriceDialog quote={reprice} onClose={() => setReprice(null)} />
      <AssignDriverDialog quote={assign} onClose={() => setAssign(null)} />
      <EscalateDialog quote={escalate} onClose={() => setEscalate(null)} />
    </Card>
  );
}

/**
 * The row's own next step as a button, with the other two behind the overflow.
 *
 * A row whose next step is not an operator's to take (waiting on the client,
 * already moving) gets no button — a screen of buttons that mostly do nothing
 * useful is what made the old table unreadable as a worklist.
 */
function RowActions({
  quote,
  action,
  onOpen,
}: {
  quote: QuoteRow;
  action: QuoteAction;
  onOpen: (quote: QuoteRow, dialog: QuoteDialog) => void;
}) {
  const t = useTranslations("admin.expedion");
  const escalatable = quote.escalationReady ?? quote.hasPickupCoords;
  const Primary = action.dialog ? DIALOG_ICON[action.dialog] : null;

  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      {action.dialog && Primary ? (
        <Button
          size="sm"
          variant={action.kind === "escalate" ? "default" : "outline"}
          className="h-8"
          disabled={action.blocked}
          title={action.blocked ? t("table.notEscalatable") : undefined}
          onClick={() => onOpen(quote, action.dialog as QuoteDialog)}
        >
          <Primary className="mr-1 h-3.5 w-3.5" />
          {t(`recent.button.${action.dialog}`)}
        </Button>
      ) : (
        <span className={cn("text-xs", NOT_ACTIONABLE_TONE)}>—</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("table.actions")}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onOpen(quote, "reprice")}>
            <Tag className="mr-2 h-4 w-4" />
            {t("actions.reprice")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpen(quote, "assign")}>
            <Truck className="mr-2 h-4 w-4" />
            {t("actions.assign")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onOpen(quote, "escalate")}
            disabled={!escalatable}
          >
            <Send className="mr-2 h-4 w-4" />
            {t("actions.escalate")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: "attention" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          tone === "attention"
            ? "bg-destructive text-white"
            : "bg-muted-foreground/15 text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}
