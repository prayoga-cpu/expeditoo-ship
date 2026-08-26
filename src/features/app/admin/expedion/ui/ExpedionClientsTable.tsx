"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/page-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";
import { useSearch } from "@/features/app/common/hooks/useSearch";

import type { ExpedionClient } from "../api/clients.api";
import { useExpedionClients } from "../hooks/useExpedionClients";
import { ExpedionClientDialog } from "./ExpedionClientDialog";

type Linked = "all" | "withAccount" | "withoutAccount";
type SortBy = "lastSeen" | "quotes" | "value" | "name";

const PAGE_SIZE = 25;

/**
 * Expedion's client book.
 *
 * Server-paginated rather than fed through the shared `DataTable`: that one
 * filters, sorts and pages in the browser, and there are 4,592 owners. Pulling
 * them all down to render twenty-five is not a table, it is a download.
 *
 * These people are mostly **not** in `/admin/users`, and no amount of fixing
 * that screen would put them there — they are quote owners, and the
 * overwhelming majority have no account in this database at all. See
 * docs/specs/admin_expedion_clients_spec.md §1.
 */
export function ExpedionClientsTable() {
  const t = useTranslations("admin.expedionClients");

  // Debounced so a typed word costs one query, not one per keystroke against
  // an aggregate over the whole quote table.
  const { searchQuery, debouncedQuery, setSearchQuery } = useSearch("", 350);
  const [linked, setLinked] = useState<Linked>("all");
  const [sortBy, setSortBy] = useState<SortBy>("lastSeen");
  const [page, setPage] = useState(1);
  const [openOwnerId, setOpenOwnerId] = useState<string | null>(null);

  // Any change to the result set sends you back to page one; staying on page
  // seven of a narrower set shows an empty table that looks like no matches.
  useEffect(() => setPage(1), [debouncedQuery, linked, sortBy]);

  const { data, isLoading, isError } = useExpedionClients({
    search: debouncedQuery || undefined,
    linked,
    sortBy,
    // Name reads A–Z; every other sort answers "most" or "latest" first.
    sortOrder: sortBy === "name" ? "asc" : "desc",
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          <Users className="h-8 w-8 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
              aria-label={t("searchPlaceholder")}
            />
          </div>

          <Select value={linked} onValueChange={(v) => setLinked(v as Linked)}>
            <SelectTrigger className="sm:w-56" aria-label={t("filter.label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filter.all")}</SelectItem>
              <SelectItem value="withAccount">
                {t("filter.withAccount")}
              </SelectItem>
              <SelectItem value="withoutAccount">
                {t("filter.withoutAccount")}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="sm:w-48" aria-label={t("sort.label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastSeen">{t("sort.lastSeen")}</SelectItem>
              <SelectItem value="quotes">{t("sort.quotes")}</SelectItem>
              <SelectItem value="value">{t("sort.value")}</SelectItem>
              <SelectItem value="name">{t("sort.name")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <CenteredEmptyState
          icon={Users}
          title={t("loadFailed")}
          description={t("loadFailedHint")}
        />
      ) : !data || data.clients.length === 0 ? (
        <CenteredEmptyState
          icon={Users}
          title={t("empty")}
          description={debouncedQuery ? t("emptySearch") : t("emptyHint")}
        />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.client")}</TableHead>
                    <TableHead>{t("table.contact")}</TableHead>
                    <TableHead className="text-right">
                      {t("table.quotes")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("table.value")}
                    </TableHead>
                    <TableHead>{t("table.lastSeen")}</TableHead>
                    <TableHead>{t("table.account")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.clients.map((client) => (
                    <ClientRow
                      key={client.ownerId}
                      client={client}
                      onOpen={() => setOpenOwnerId(client.ownerId)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("count", { total: data.total })}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t("pageOf", { page: data.page, totalPages: data.totalPages })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={t("previousPage")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label={t("nextPage")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <ExpedionClientDialog
        ownerId={openOwnerId}
        onOpenChange={(open) => !open && setOpenOwnerId(null)}
      />
    </div>
  );
}

/**
 * Module-level, not nested in the table: a component declared inside another
 * is a new type on every render, so React would unmount and rebuild every row
 * each time the search box changed.
 */
function ClientRow({
  client,
  onOpen,
}: {
  client: ExpedionClient;
  onOpen: () => void;
}) {
  const t = useTranslations("admin.expedionClients");
  const format = useFormatter();

  return (
    <TableRow
      className="cursor-pointer"
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <TableCell>
        <p className="font-medium text-foreground">
          {client.name ?? t("noName")}
        </p>
        <button
          type="button"
          className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            // The row opens the dialog; without this, copying an id opens it
            // too.
            e.stopPropagation();
            navigator.clipboard.writeText(client.ownerId);
            toast.success(t("ownerIdCopied"));
          }}
          title={client.ownerId}
        >
          <Copy className="h-3 w-3" />
          {client.ownerId.length > 18
            ? `${client.ownerId.slice(0, 18)}…`
            : client.ownerId}
        </button>
      </TableCell>

      <TableCell>
        <p className="text-sm text-foreground">{client.email ?? "—"}</p>
        <p className="text-xs text-muted-foreground">
          {[client.phone, client.city].filter(Boolean).join(" · ") || "—"}
        </p>
      </TableCell>

      <TableCell className="text-right">
        <span className="font-mono tabular-nums">{client.quoteCount}</span>
        <p className="text-xs text-muted-foreground">
          {t("paidOf", { paid: client.paidCount })}
        </p>
      </TableCell>

      <TableCell className="text-right font-mono tabular-nums">
        {formatCurrency(client.paidValueCents)}
      </TableCell>

      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {format.dateTime(new Date(client.lastSeenAt), { dateStyle: "medium" })}
      </TableCell>

      <TableCell onClick={(e) => e.stopPropagation()}>
        {client.account ? (
          <Link
            href={`/admin/users?search=${encodeURIComponent(client.account.email)}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <UserRound className="h-3.5 w-3.5" />
            {t("openAccount")}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          // The common case, and not an error: a client with no account here
          // has nothing to suspend, impersonate or reset.
          <Badge
            variant="outline"
            className="border-border bg-muted text-muted-foreground"
          >
            {t("noAccount")}
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
