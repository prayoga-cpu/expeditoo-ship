"use client";

import { useRouter } from "next/navigation";
import {
  AlertCircle,
  List,
  Map as MapIcon,
  PackageSearch,
  SlidersHorizontal,
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
import { RouteSearchBar } from "./RouteSearchBar";
import { BoardMap } from "./BoardMap";
import { useTranslations } from "next-intl";
import { useJobBoard } from "../hooks/useJobBoard";
import { useAuth } from "@/lib/auth-context";
import { useActiveAccessMode } from "@/lib/use-active-access-mode";
import { hasDriverAccess } from "@/lib/active-access";
import Link from "next/link";
import { EMPTY_SEARCH, type SearchDraft } from "../hooks/useSearchDraft";
import type { BoardJob, BoardPane, JobSort } from "../types";

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
    refetch,
    filters,
    updateFilters,
    resetFilters,
    activeFilterCount,
    page,
    setPage,
  } = useJobBoard({ origin });

  const router = useRouter();
  const { user } = useAuth();
  const { mode: accessMode, qualifiedModes, setMode: setAccessMode } = useActiveAccessMode();
  const roles = user?.roles ?? [];
  // Reading is open to any session; bidding is not. Say so, rather than let a
  // pending applicant wonder why a board they can see has no way in.
  const canBid = hasDriverAccess(roles);
  const showPendingNotice = !!user && !canBid;
  // A driver browsing in Requester mode: the board is here, their offers and
  // runs are one switch away.
  const showModeNotice = canBid && accessMode === "user" && qualifiedModes.includes("carrier");

  // The search card holds its own draft, seeded once. Clearing everything
  // from outside the card — the empty state's button — remounts it.
  const [searchKey, setSearchKey] = useState(0);

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

  // The sheet's badge counts what the sheet holds; the search card shows its
  // own fields.
  const sheetFilterCount = [
    filters.minBudget,
    filters.maxBudget,
    filters.maxWeightKg,
  ].filter((value) => value !== null).length;

  /**
   * « Rechercher » and « Effacer »: the card's fields, committed together.
   * Sorting by distance needs a point to measure from, so it falls back to
   * the newest when the search no longer names one.
   */
  const search = (next: SearchDraft) =>
    updateFilters({
      ...next,
      sort:
        !next.from && filters.sort === "distance_asc"
          ? "created_desc"
          : filters.sort,
    });

  const clearEverything = () => {
    resetFilters();
    setSearchKey((key) => key + 1);
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
      {/*
        From `lg` the board is a fixed-height pane that scrolls on its own, so
        the shell's bottom padding does not reach it — and the floating nav
        (shown until `xl`) sat over the last card and its « Faire une offre »
        on a tablet. The pane clears the nav itself.
      */}
      <div className="w-full space-y-4 p-4 sm:p-6 lg:max-w-2xl lg:shrink-0 lg:overflow-y-auto lg:pb-6">
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

      {showPendingNotice && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm">
          <span>{t("pendingNotice")}</span>
          <Button asChild size="sm" variant="outline">
            <Link href="/carrier/application">{t("pendingNoticeAction")}</Link>
          </Button>
        </div>
      )}
      {showModeNotice && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
          <span>{t("modeNotice")}</span>
          <Button size="sm" variant="outline" onClick={() => setAccessMode("carrier")}>
            {t("modeNoticeAction")}
          </Button>
        </div>
      )}

      <RouteSearchBar
        key={searchKey}
        filters={filters}
        onSearch={search}
        onClear={() => search(EMPTY_SEARCH)}
        onShowMap={() => changePane("map")}
      />

      {/* What narrows the answer rather than asks the question: budget,
          weight and the order. They apply as they change. */}
      <div className="flex justify-end">
        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="shrink-0" aria-label={t("filters")}>
                <SlidersHorizontal className="h-4 w-4" />
                {sheetFilterCount > 0 && (
                  <Badge className="ml-2 px-1.5">{sheetFilterCount}</Badge>
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

                <Button variant="ghost" onClick={clearEverything} className="w-full">
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
          {/* A failed read is usually not the filters' fault: try again
              first (no_dead_ends_spec.md §4). */}
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => void refetch()}>{t("retry")}</Button>
            <Button variant="outline" onClick={clearEverything}>
              {t("clearFilters")}
            </Button>
          </div>
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
            <Button
              variant="outline"
              onClick={clearEverything}
              data-testid="board-empty-clear"
            >
              {t("clearSearch")}
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
                <JobCard
                  job={job}
                  isHighlighted={job.id === highlightedId}
                  offerAction={!(job as BoardJob).hasBid && job.shipperId !== user?.id}
                />
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
          // The map's attribution sits on its bottom edge; keep it above the nav.
          "lg:pb-0",
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
