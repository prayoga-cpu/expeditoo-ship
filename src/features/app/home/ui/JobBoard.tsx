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
import { useJobBoard } from "../hooks/useJobBoard";
import type { JobSort } from "../types";

const SORTS: { value: JobSort; label: string }[] = [
  { value: "created_desc", label: "Newest" },
  { value: "budget_desc", label: "Highest budget" },
  { value: "budget_asc", label: "Lowest budget" },
  { value: "pickup_asc", label: "Earliest pickup" },
];

/**
 * The job board: every open transport job, for drivers to find work.
 *
 * Escalated Expedion jobs appear here on exactly the same terms as direct
 * ones - "everything downstream is identical" (ROADMAP.md §3).
 */
export function JobBoard() {
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
  } = useJobBoard();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Open jobs</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading…"
            : `${total} job${total === 1 ? "" : "s"} accepting offers`}
        </p>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => updateFilters({ q: e.target.value })}
            placeholder="Search jobs"
            className="pl-9"
            aria-label="Search jobs"
          />
          {filters.q && (
            <button
              onClick={() => updateFilters({ q: "" })}
              aria-label="Clear search"
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
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="minBudget">Min budget (€)</Label>
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
                  <Label htmlFor="maxBudget">Max budget (€)</Label>
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
                <Label htmlFor="maxWeight">
                  Max weight my vehicle can carry (kg)
                </Label>
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
                  Hides jobs heavier than this.
                </p>
              </div>

              <Button variant="ghost" onClick={resetFilters} className="w-full">
                Clear filters
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
                {sort.label}
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
          title="No jobs match"
          description={
            activeFilterCount > 0 || filters.q
              ? "Try widening your filters — new jobs are posted through the day."
              : "No jobs are open right now. New ones appear as shippers post them."
          }
        >
          {(activeFilterCount > 0 || filters.q) && (
            <Button variant="outline" onClick={resetFilters}>
              Clear filters
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
                Previous
              </Button>
              <span className="font-mono text-sm text-muted-foreground">
                {page} / {Math.ceil(total / 20)}
              </span>
              <Button
                variant="outline"
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
