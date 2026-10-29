"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CircleDot,
  Flag,
  LocateFixed,
  Plus,
  Route,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CityField } from "@/components/ui/city-field";
import { PageLoader } from "@/components/ui/page-loader";
import { ApiError } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { useDriverShipments } from "@/features/app/driver/hooks/useDriverShipments";
import type { PlaceValue } from "@/features/app/home/types";
import { routePlanApi } from "../api/route-plan.api";
import {
  durationLabel,
  moveStop,
  outOfOrder,
  planPoints,
  type PlanStop,
} from "../lib/plan-stops";

const PlanMap = dynamic(() => import("./PlanMap").then((m) => m.PlanMap), {
  ssr: false,
  loading: () => <PageLoader />,
});

/** Runs still to drive: a pickup ahead, or goods on board. */
const LIVE = new Set(["ASSIGNED", "PICKED_UP", "IN_TRANSIT"]);

/**
 * « Planificateur de tournée » (client_feedback_2026_10_29_spec.md §N8): a
 * departure, the driver's own runs and any town, reordered by hand, an
 * arrival that may be the departure — and the trip timed twice, by motorway
 * and avoiding it. Nothing is saved: the plan is the driver's scratch paper.
 */
export function RoutePlanner() {
  const t = useTranslations("carrier.planner");
  const { shipments, isLoading } = useDriverShipments();
  const [departure, setDeparture] = useState<PlaceValue | null>(null);
  const [arrival, setArrival] = useState<PlaceValue | null>(null);
  const [stops, setStops] = useState<PlanStop[]>([]);
  const [extra, setExtra] = useState<PlaceValue | null>(null);
  const [locating, setLocating] = useState(false);

  const plan = useMutation({
    mutationFn: routePlanApi.plan,
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      toast.error(
        ["NO_ROUTE", "ROUTER_UNREACHABLE", "ROUTER_FAILED"].includes(code)
          ? t(`errors.${code}`)
          : t("errors.generic")
      );
    },
  });

  const runs = shipments.filter((s) => LIVE.has(s.status));
  const planned = new Set(
    stops.flatMap((s) => (s.kind === "stop" ? [] : [s.runId]))
  );
  const badRuns = outOfOrder(stops);
  const points = planPoints(departure, stops, arrival);

  const addRun = (runId: string) => {
    const run = runs.find((r) => r.id === runId);
    if (!run) return;
    const title = run.listing?.title ?? t("untitled");
    const next: PlanStop[] = [];
    // Goods already on board have nowhere to be collected from.
    if (run.status === "ASSIGNED") {
      next.push({
        key: `${run.id}-pickup`,
        kind: "pickup",
        runId: run.id,
        label: t("pickupOf", { title }),
        point: { lat: run.pickupLat, lng: run.pickupLng },
      });
    }
    next.push({
      key: `${run.id}-dropoff`,
      kind: "dropoff",
      runId: run.id,
      label: t("dropoffOf", { title }),
      point: { lat: run.dropoffLat, lng: run.dropoffLng },
    });
    setStops((current) => [...current, ...next]);
  };

  const removeRun = (runId: string) =>
    setStops((current) =>
      current.filter((s) => s.kind === "stop" || s.runId !== runId)
    );

  const addExtra = () => {
    if (!extra) return;
    setStops((current) => [
      ...current,
      { key: `stop-${Date.now()}`, kind: "stop", label: extra.label, point: { lat: extra.lat, lng: extra.lng } },
    ]);
    setExtra(null);
  };

  const fromMyPosition = () => {
    if (!("geolocation" in navigator)) {
      toast.error(t("positionUnavailable"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (fix) => {
        setLocating(false);
        setDeparture({
          label: t("myPosition"),
          lat: Math.round(fix.coords.latitude * 1e4) / 1e4,
          lng: Math.round(fix.coords.longitude * 1e4) / 1e4,
        });
      },
      () => {
        setLocating(false);
        toast.error(t("positionDenied"));
      },
      { timeout: 10_000, maximumAge: 300_000 }
    );
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <CityField
            id="plan-from"
            value={departure}
            onChange={setDeparture}
            placeholder={t("departure")}
            icon={<CircleDot className="h-4 w-4" />}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={fromMyPosition}
            disabled={locating}
            aria-label={t("useMyPosition")}
            title={t("useMyPosition")}
          >
            <LocateFixed className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t("myRuns")}</p>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRuns")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {runs.map((run) => {
                const added = planned.has(run.id);
                return (
                  <Button
                    key={run.id}
                    type="button"
                    size="sm"
                    variant={added ? "secondary" : "outline"}
                    aria-pressed={added}
                    onClick={() => (added ? removeRun(run.id) : addRun(run.id))}
                  >
                    {added ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {run.listing?.title ?? t("untitled")}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <CityField
            id="plan-extra"
            value={extra}
            onChange={setExtra}
            placeholder={t("addStop")}
            icon={<Plus className="h-4 w-4" />}
            className="min-w-0 flex-1"
          />
          <Button type="button" variant="outline" onClick={addExtra} disabled={!extra}>
            {t("add")}
          </Button>
        </div>

        {stops.length > 0 && (
          <ol className="space-y-1.5" aria-label={t("stopsLabel")}>
            {stops.map((stop, index) => {
              const wrong = stop.kind === "dropoff" && badRuns.includes(stop.runId);
              return (
                <li
                  key={stop.key}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm",
                    wrong && "border-warning/50 bg-warning/10"
                  )}
                >
                  <span className="w-5 shrink-0 text-center font-mono text-xs text-muted-foreground">
                    {index + 1 + (departure ? 1 : 0)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{stop.label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={index === 0}
                    onClick={() => setStops((s) => moveStop(s, index, -1))}
                    aria-label={t("moveUp", { stop: stop.label })}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={index === stops.length - 1}
                    onClick={() => setStops((s) => moveStop(s, index, 1))}
                    aria-label={t("moveDown", { stop: stop.label })}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() =>
                      stop.kind === "stop"
                        ? setStops((s) => s.filter((x) => x.key !== stop.key))
                        : removeRun(stop.runId)
                    }
                    aria-label={t("remove", { stop: stop.label })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
        {badRuns.length > 0 && (
          <p className="flex items-start gap-1.5 text-sm text-warning">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t("outOfOrder")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <CityField
            id="plan-to"
            value={arrival}
            onChange={setArrival}
            placeholder={t("arrival")}
            icon={<Flag className="h-4 w-4" />}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!departure}
            onClick={() => setArrival(departure)}
          >
            <Undo2 className="h-4 w-4" />
            {t("backToStart")}
          </Button>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={points.length < 2 || badRuns.length > 0 || plan.isPending}
            onClick={() => plan.mutate(points)}
          >
            <Route className="h-4 w-4" />
            {plan.isPending ? t("planning") : t("plan")}
          </Button>
        </div>
      </Card>

      {plan.data && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="gap-1 p-4">
              <p className="text-sm text-muted-foreground">{t("withMotorway")}</p>
              <p className="font-mono text-xl font-semibold tabular-nums">
                {durationLabel(plan.data.withMotorway.durationMinutes)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("km", { km: plan.data.withMotorway.distanceKm })}
              </p>
            </Card>
            <Card className="gap-1 p-4">
              <p className="text-sm text-muted-foreground">{t("withoutMotorway")}</p>
              <p className="font-mono text-xl font-semibold tabular-nums">
                {durationLabel(plan.data.withoutMotorway.durationMinutes)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("km", { km: plan.data.withoutMotorway.distanceKm })}
              </p>
            </Card>
          </div>
          <PlanMap plan={plan.data} points={points} />
          <p className="text-xs text-muted-foreground">{t("estimateNote")}</p>
        </div>
      )}
    </div>
  );
}
