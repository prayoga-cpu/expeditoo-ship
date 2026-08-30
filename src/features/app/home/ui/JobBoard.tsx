"use client";

import { useRouter } from "next/navigation";
import {
  AlertCircle,
  List,
  Map as MapIcon,
  PackageSearch,
  SlidersHorizontal,
  Search,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { JobCard } from "./JobCard";
import { ExpedionSourceBanner } from "./ExpedionSourceBanner";
import { RouteSearchBar } from "./RouteSearchBar";
import { BoardMap } from "./BoardMap";
import { AvailabilityField } from "./AvailabilityField";
import { useTranslations } from "next-intl";
import { useJobBoard } from "../hooks/useJobBoard";
import type { BoardPane, JobSort, SearchMode } from "../types";

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
    isError,
    filters,
    updateFilters,
    resetFilters,
    activeFilterCount,
    page,
    setPage,
  } = useJobBoard({ origin });

  const router = useRouter();

  // Which shape the location filter wears. A deep link carrying an arrival
  // opens on the corridor it describes.
  const [mode, setMode] = useState<SearchMode>(filters.to ? "route" : "around");

  // Desktop shows both halves side by side; a phone has room for one, so it
  // gets a switch rather than a squeezed map.
  const [pane, setPane] = useState<BoardPane>("list");

  // The card and the pin for one job light up together, whichever the pointer
  // is over.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);

  /**
   * On a phone the map sits below the controls, so switching to it without
   * scrolling leaves the driver looking at the same filters they just used.
   */
  const changePane = (next: BoardPane) => {
    setPane(next);
    if (next === "map") {
      requestAnimationFrame(() =>
        mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  };

  const changeMode = (next: SearchMode) => {
    setMode(next);
    // "Autour de" has no arrival field, so leaving one behind would filter on
    // a corridor the driver can no longer see — and étapes with nowhere to go
    // describe no path.
    if (next === "around" && filters.to) updateFilters({ to: null, via: [] });
  };

  // Distance only means something once there is a point to measure from, and
  // in "sur mon trajet" it measures the detour rather than the distance.
  const sorts = filters.from
    ? [
        ...SORTS,
        {
          value: "distance_asc" as JobSort,
          labelKey: filters.to ? "detourAsc" : "distanceAsc",
        },
      ]
    : SORTS;

  return (
    <div className="flex w-full flex-col lg:h-[calc(100dvh-4rem)] lg:flex-row lg:overflow-hidden">
      {/*
        The search and the results scroll; the map does not. On a phone the two
        are alternatives, chosen by the switch below the filters.
      */}
      <div className="w-full space-y-4 p-4 sm:p-6 lg:max-w-2xl lg:shrink-0 lg:overflow-y-auto">
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

      <ExpedionSourceBanner />

      <RouteSearchBar
        mode={mode}
        onModeChange={changeMode}
        filters={filters}
        onChange={updateFilters}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:flex-1">
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

        <div className="flex gap-2">
          <AvailabilityField
            days={filters.days}
            slots={filters.slots}
            onChange={updateFilters}
            className="min-w-0 flex-1 sm:flex-none"
          />

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
            <SelectTrigger className="w-[140px] shrink-0" aria-label={t("sortLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sorts.map((sort) => (
                <SelectItem key={sort.value} value={sort.value}>
                  {t(`sort.${sort.labelKey}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ToggleGroup
        type="single"
        value={pane}
        onValueChange={(next) => next && changePane(next as BoardPane)}
        variant="outline"
        className="w-full lg:hidden"
        aria-label={t("paneLabel")}
      >
        <ToggleGroupItem value="list" className="flex-1">
          <List className="h-4 w-4" />
          {t("pane.list")}
        </ToggleGroupItem>
        <ToggleGroupItem value="map" className="flex-1">
          <MapIcon className="h-4 w-4" />
          {t("pane.map")}
        </ToggleGroupItem>
      </ToggleGroup>

      <div className={cn("space-y-4", pane === "map" && "hidden lg:block")}>
      {isError ? (
        <CenteredEmptyState
          icon={AlertCircle}
          title={t("error.title")}
          description={t("error.description")}
        >
          <Button variant="outline" onClick={resetFilters}>
            {t("clearFilters")}
          </Button>
        </CenteredEmptyState>
      ) : isLoading ? (
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
              <div
                key={job.id}
                id={`job-${job.id}`}
                onMouseEnter={() => setHighlightedId(job.id)}
                onMouseLeave={() => setHighlightedId(null)}
              >
                <JobCard job={job} isHighlighted={job.id === highlightedId} />
              </div>
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
      </div>

      {/*
        The map is the other half of the same answer: the pins are the rows,
        placed. It renders on every viewport so the switch has something to
        switch to, and fills the column on a desktop.
      */}
      <div
        ref={mapRef}
        className={cn(
          // A definite height, not a min-height: the map fills its box with
          // `height: 100%`, and a percentage against a parent that only has a
          // minimum resolves to zero. On a desktop the flex row supplies the
          // height instead.
          "h-[70vh] w-full border-t lg:h-auto lg:flex-1 lg:border-t-0 lg:border-l",
          pane === "list" && "hidden lg:block"
        )}
      >
        <BoardMap
          jobs={jobs}
          filters={filters}
          isLoading={isLoading}
          highlightedId={highlightedId}
          onHighlight={setHighlightedId}
          onSelect={(id) => router.push(`/listing/${id}`)}
          className="h-full"
        />
      </div>
    </div>
  );
}
