"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowRight,
  MoreVertical,
  Package,
  Pencil,
  RotateCcw,
  Send,
  Tag,
  Truck,
} from "lucide-react";
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
  dateRangeFilterFn,
} from "@/features/app/admin/ui/data-table";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { QuoteRow } from "@/server/dal/expedion-report.dal";

import { AssignDriverDialog } from "./AssignDriverDialog";
import { EscalateDialog } from "./EscalateDialog";
import { QuoteDetailDialog } from "./QuoteDetailDialog";
import { RepriceDialog } from "./RepriceDialog";
import { RequoteDialog } from "./RequoteDialog";
import { StorageDialog } from "./StorageDialog";
import {
  escalationHoursLeft,
  isNewQuote,
  nextAction,
  quoteCapabilities,
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
 * Two views over the same rows, both newest-first: **To handle** (default
 * when there is any) is just the actionable subset; **All** is the full feed.
 * Every row states what it is waiting for and offers exactly that action as
 * its button, so an operator never has to open a dropdown to find out
 * whether there is anything to do.
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
  storage: Package,
  requote: RotateCcw,
};

function money(cents: number | null): string {
  if (cents === null) return "—";
  return formatCurrency(cents, { fractionDigits: 0 });
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
  const tb = useTranslations("admin.expedion.blockers");
  const locale = useLocale();
  const [tab, setTab] = useState<"todo" | "all" | null>(null);
  const [reprice, setReprice] = useState<QuoteRow | null>(null);
  const [assign, setAssign] = useState<QuoteRow | null>(null);
  const [escalate, setEscalate] = useState<QuoteRow | null>(null);
  const [storage, setStorage] = useState<QuoteRow | null>(null);
  const [requote, setRequote] = useState<QuoteRow | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  // Set alongside `detail` when the row that opened it is not escalation-
  // ready — the dialog opens straight into edit mode, on the blocker that
  // sent the operator here, rather than the read-only view.
  const [detailAutoEdit, setDetailAutoEdit] = useState(false);

  // One `now` for the whole render, so the age column, the "new" dots and the
  // sort cannot each be computed against a slightly different clock.
  const now = useMemo(() => new Date(), [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // `rows` arrives newest-first (the report's `getRecentQuotes` query orders
  // by `requested_at desc`); filtering to the actionable subset preserves
  // that order rather than re-ranking by urgency, so a quote that just came
  // in surfaces immediately instead of waiting behind older backlog.
  const { todo, all, newCount } = useMemo(() => {
    const decorated = rows.map((row) => ({ row, action: nextAction(row) }));
    return {
      todo: decorated.filter((d) => d.action.actionable).map((d) => d.row),
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
    if (dialog === "storage") setStorage(quote);
    if (dialog === "requote") setRequote(quote);
    if (dialog === "escalate") {
      // Not ready — no dialog can publish it, so open the one that can fix
      // it instead of a confirm box that only fails.
      if (quote.escalationReady ?? quote.hasPickupCoords) {
        setEscalate(quote);
      } else {
        setDetail(quote.id);
        setDetailAutoEdit(true);
      }
    }
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
        // Enables both the header click-to-sort and the toolbar's "sort by"
        // dropdown — an id-only column otherwise has no value to sort on.
        accessorFn: (row) => row.priceCents,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.amount")} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {money(row.original.priceCents)}
          </span>
        ),
      },
      {
        id: "waiting",
        // Sorting and the date-range filter both need `getValue("waiting")`
        // to resolve to the underlying `requestedAt`, which this id-only
        // column otherwise has no accessor for.
        accessorFn: (row) => row.requestedAt,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("recent.waiting")} />
        ),
        cell: ({ row }) => {
          const days = storageDaysLeft(row.original, now);
          const atRisk = row.original.queues.storageAtRisk && days !== null;
          // Only while the fork is open. Once the deadline passes the row is
          // already `escalate`, and a countdown under a badge that says the
          // time is up reads as a contradiction.
          const hours = row.original.queues.needsDriver
            ? escalationHoursLeft(row.original, now)
            : null;
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
              {hours !== null ? (
                <span
                  className={cn(
                    "text-[10px]",
                    hours <= 4
                      ? "text-amber-600 dark:text-amber-500"
                      : "text-muted-foreground"
                  )}
                  title={exact(row.original.escalateAfter, locale)}
                >
                  {t("recent.autoPublishIn", { count: hours })}
                </span>
              ) : null}
            </div>
          );
        },
        filterFn: dateRangeFilterFn<QuoteRow>(),
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
          const blockerList = action.blockers?.length
            ? action.blockers.map((code) => tb(code)).join(", ")
            : undefined;
          return (
            <Badge
              className={cn("border", TONE[action.kind])}
              variant="outline"
              title={blockerList}
            >
              {/* Keyed on `blocked`, not on the kind: a paid row that fails
                  the ten checks is blocked whichever lane the operator wanted,
                  and "Needs a driver" next to a button that only opens a fix
                  form is the pair that sends them round in circles. */}
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
    // `now` is stable for the life of a `rows` array; `t`, `tb` and `locale`
    // change only with the language.
    [locale, now, t, tb]
  );

  const sortFields = [
    { id: "reference", label: t("table.reference") },
    { id: "amount", label: t("table.amount") },
    { id: "waiting", label: t("recent.waiting") },
  ];

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
            onRowClick={(row) => {
              setDetail(row.id);
              setDetailAutoEdit(false);
            }}
            dateFilterKey="waiting"
            sortFields={sortFields}
          />
        )}
      </CardContent>

      {/* Mounted only while open: it fetches the whole quote on mount, and a
          detail view for a row nobody clicked is a request nobody asked for. */}
      {detail ? (
        <QuoteDetailDialog
          quoteId={detail}
          autoEdit={detailAutoEdit}
          onClose={() => {
            setDetail(null);
            setDetailAutoEdit(false);
          }}
        />
      ) : null}
      <RepriceDialog quote={reprice} onClose={() => setReprice(null)} />
      <AssignDriverDialog quote={assign} onClose={() => setAssign(null)} />
      <EscalateDialog quote={escalate} onClose={() => setEscalate(null)} />
      <StorageDialog quote={storage} onClose={() => setStorage(null)} />
      <RequoteDialog quote={requote} onClose={() => setRequote(null)} />
    </Card>
  );
}

/**
 * The row's next step as buttons, with anything else it may still do behind
 * the overflow.
 *
 * A row whose next step is not an operator's to take (waiting on the client,
 * already moving) gets no button — a screen of buttons that mostly do nothing
 * useful is what made the old table unreadable as a worklist.
 *
 * A paid row gets two, because payment is a fork rather than a queue: assign
 * from the pool, or publish and let carriers bid. Both were always legal here;
 * only one was reachable without opening a menu, which made the escalation
 * timer look like it was making the decision.
 *
 * The overflow is filtered by `quoteCapabilities`, so it stops offering
 * "Adjust price" on a paid quote and "Assign a driver" on a delivered one —
 * every entry it shows is one the server will accept.
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
  const tb = useTranslations("admin.expedion.blockers");
  const can = quoteCapabilities(quote);
  const escalatable = quote.escalationReady ?? quote.hasPickupCoords;
  const blockerList = action.blockers?.length
    ? action.blockers.map((code) => tb(code)).join(", ")
    : undefined;

  // Everything this row could do, minus what it is already offering as a
  // button — repeating the primary action inside the menu behind it is noise.
  const overflow = (
    [
      ["reprice", can.canReprice, Tag, t("actions.reprice")],
      ["assign", can.canAssign, Truck, t("actions.assign")],
      ["storage", can.canEditStorage, Package, t("actions.storageTitle")],
      [
        "escalate",
        can.canEscalate,
        escalatable ? Send : Pencil,
        escalatable ? t("actions.escalate") : t("recent.button.fix"),
      ],
      // Last, and never a primary button: unwinding a settled quote is a
      // correction, not a step anyone is waiting on.
      ["requote", can.canRequote, RotateCcw, t("actions.requote")],
    ] as const
  ).filter(([dialog, allowed]) => allowed && !action.dialogs.includes(dialog));

  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      {action.dialogs.length > 0 ? (
        action.dialogs.map((dialog, index) => (
          <PrimaryButton
            key={dialog}
            dialog={dialog}
            action={action}
            // Only the first is emphasised. Two filled buttons side by side
            // read as "these are both urgent" rather than "pick one".
            emphasised={index === 0}
            title={blockerList}
            onClick={() => onOpen(quote, dialog)}
          />
        ))
      ) : (
        <span className={cn("text-xs", NOT_ACTIONABLE_TONE)}>—</span>
      )}
      {overflow.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("table.actions")}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflow.map(([dialog, , Icon, label]) => (
              <DropdownMenuItem
                key={dialog}
                onClick={() => onOpen(quote, dialog)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

/**
 * One of the row's action buttons.
 *
 * `blocked` only ever applies to publishing, and only the button that
 * publishes: on a paid row offering both, "Assign" must not turn into "Fix"
 * because the *other* button's target is missing a postal code.
 */
function PrimaryButton({
  dialog,
  action,
  emphasised,
  title,
  onClick,
}: {
  dialog: QuoteDialog;
  action: QuoteAction;
  emphasised: boolean;
  title?: string;
  onClick: () => void;
}) {
  const t = useTranslations("admin.expedion");
  const blocked = dialog === "escalate" && !!action.blocked;
  // Blocked from publishing: the button still opens something real — the
  // fix-and-publish view inside the quote detail dialog — so it stays
  // enabled rather than disabled with nowhere to go.
  const Icon = blocked ? Pencil : DIALOG_ICON[dialog];

  return (
    <Button
      size="sm"
      variant={
        emphasised && action.kind === "escalate" && !blocked
          ? "default"
          : "outline"
      }
      className="h-8"
      title={blocked ? title : undefined}
      onClick={onClick}
    >
      <Icon className="mr-1 h-3.5 w-3.5" />
      {blocked ? t("recent.button.fix") : t(`recent.button.${dialog}`)}
    </Button>
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
