"use client";

import { PackageSearch, SlidersHorizontal, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { JobCard } from "./JobCard";
import { useTranslations } from "next-intl";
import { useJobBoard } from "../hooks/useJobBoard";
import type { JobSort } from "../types";

const SORTS: { value: JobSort; labelKey: string }[] = [
  { value: "created_desc", labelKey: "newest" },
  { value: "budget_desc", labelKey: "budgetDesc" },
  { value: "budget_asc", labelKey: "budgetAsc" },
  { value: "pickup_asc", labelKey: "pickupAsc" },
];

/**
 * The job board: open transport jobs, for drivers to find work.
 *
 * `origin` pins the board to one inlet. Expedion escalation is the only source
 * of demand, so `/expedion` passes `expedion` and legacy `direct` rows stay off
 * the list. Everything downstream of the board is identical either way
 * (ROADMAP.md §3).
 */
export function JobBoard({ origin }: { origin?: "direct" | "expedion" } = {}) {
  const t = useTranslations("jobBoard");
  const {
    jobs,
    total,
    isLoading,
    filters,
    updateFilters,
    resetFilters,
    activeFilterCount,
    page,
    setPage,
  } = useJobBoard({ origin });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? t("loading")
            : total === 1
              ? t("countOne", { count: total })
              : t("count", { count: total })}
        </p>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => updateFilters({ q: e.target.value })}
            placeholder={t("search")}
            className="pl-9"
            aria-label={t("search")}
          />
          {filters.q && (
            <button
              onClick={() => updateFilters({ q: "" })}
              aria-label={t("clearSearch")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <Badge className="ml-2 px-1.5">{activeFilterCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>{t("filters")}</SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="minBudget">{t("minBudget")}</Label>
                  <Input
                    id="minBudget"
                    type="number"
                    min={0}
                    value={filters.minBudget ?? ""}
                    onChange={(e) =>
                      updateFilters({
                        minBudget: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="maxBudget">{t("maxBudget")}</Label>
                  <Input
                    id="maxBudget"
                    type="number"
                    min={0}
                    value={filters.maxBudget ?? ""}
                    onChange={(e) =>
                      updateFilters({
                        maxBudget: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="maxWeight">{t("maxWeight")}</Label>
                <Input
                  id="maxWeight"
                  type="number"
                  min={0}
                  value={filters.maxWeightKg ?? ""}
                  onChange={(e) =>
                    updateFilters({
                      maxWeightKg: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("maxWeightHint")}
                </p>
              </div>

              <Button variant="ghost" onClick={resetFilters} className="w-full">
                {t("clearFilters")}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <Select
          value={filters.sort}
          onValueChange={(v) => updateFilters({ sort: v as JobSort })}
        >
          <SelectTrigger className="w-[150px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((sort) => (
              <SelectItem key={sort.value} value={sort.value}>
                {t(`sort.${sort.labelKey}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <CenteredEmptyState
          icon={PackageSearch}
          title={t("empty.title")}
          description={
            activeFilterCount > 0 || filters.q
              ? t("empty.filtered")
              : t("empty.none")
          }
        >
          {(activeFilterCount > 0 || filters.q) && (
            <Button variant="outline" onClick={resetFilters}>
              {t("clearFilters")}
            </Button>
          )}
        </CenteredEmptyState>
      ) : (
        <>
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          {total > jobs.length && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                {t("previous")}
              </Button>
              <span className="font-mono text-sm text-muted-foreground">
                {page} / {Math.ceil(total / 20)}
              </span>
              <Button
                variant="outline"
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => setPage(page + 1)}
              >
                {t("next")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
