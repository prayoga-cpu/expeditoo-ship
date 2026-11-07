"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { PageLoader } from "@/components/ui/page-loader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSearch } from "@/features/app/common/hooks/useSearch";
import { useBordereaux } from "../hooks/useBordereaux";

const PAGE_SIZE = 25;

/**
 * Every slip in one table — number, buyer, contact, billing address, sale date,
 * description — with a search over all of it and a CSV of whatever the search
 * matches. It is the spreadsheet the client kept in Airtable, here, beside the
 * documents themselves. Server-paginated: there are thousands of rows.
 */
export function BordereauxTable() {
  const t = useTranslations("admin.bordereaux");
  const { searchQuery, debouncedQuery, setSearchQuery } = useSearch("", 350);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [debouncedQuery]);

  const { data, isLoading, isError, refetch } = useBordereaux({
    q: debouncedQuery || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const exportHref = `/api/admin/expedion/bordereaux/export${
    debouncedQuery ? `?q=${encodeURIComponent(debouncedQuery)}` : ""
  }`;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
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
          <Button asChild variant="outline">
            <a href={exportHref} download>
              <Download className="mr-2 h-4 w-4" />
              {t("export")}
            </a>
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <LoadErrorState title={t("loadFailed")} description={t("loadFailedHint")} onRetry={() => void refetch()} />
      ) : !data || data.rows.length === 0 ? (
        <CenteredEmptyState
          icon={FileSpreadsheet}
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
                    <TableHead>{t("table.number")}</TableHead>
                    <TableHead>{t("table.client")}</TableHead>
                    <TableHead>{t("table.contact")}</TableHead>
                    <TableHead>{t("table.address")}</TableHead>
                    <TableHead>{t("table.saleDate")}</TableHead>
                    <TableHead>{t("table.description")}</TableHead>
                    <TableHead className="text-right">{t("table.documents")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-sm">{row.bordereauNumber ?? "—"}</TableCell>
                      <TableCell className="font-medium">
                        {[row.firstName, row.lastName].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{row.email ?? "—"}</div>
                        <div className="text-muted-foreground">{row.phone ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {[row.clientAddress, [row.clientPostalCode, row.clientCity].filter(Boolean).join(" ")]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{row.saleDate ?? "—"}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm" title={row.description ?? undefined}>
                        {row.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.bordereauDocUrl ? (
                          <a
                            href={row.bordereauDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                          >
                            {t("openSlip")}
                            {row.documentCount > 1 ? ` (+${row.documentCount - 1})` : ""}
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {row.documentCount > 0 ? t("documentsCount", { count: row.documentCount }) : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("count", { total: data.total })}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("pageOf", { page, totalPages })}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={t("previousPage")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label={t("nextPage")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
