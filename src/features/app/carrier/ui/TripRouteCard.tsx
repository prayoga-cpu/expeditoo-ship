"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  ArrowRight,
  Eye,
  EyeOff,
  MapPin,
  Pencil,
  Search,
  Trash2,
  Truck,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { routeMatchHref } from "@/lib/carrier-route-matching";
import type { CarrierRoute } from "../api/trips.api";

const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

interface TripRouteCardProps {
  route: CarrierRoute;
  onEdit: (route: CarrierRoute) => void;
  onDelete: (route: CarrierRoute) => void;
  onToggle: (route: CarrierRoute, isActive: boolean) => void;
}

/**
 * One declared trip. The primary action is the board deep-link: a trip that
 * cannot be turned into a list of jobs is just a note to self.
 */
export function TripRouteCard({
  route,
  onEdit,
  onDelete,
  onToggle,
}: TripRouteCardProps) {
  const t = useTranslations("carrier.trips");

  const title =
    route.label || `${route.originCity} → ${route.destinationCity}`;

  return (
    <Card className={route.isActive ? undefined : "opacity-60"}>
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold">{title}</h3>
              <Badge variant="outline">{t(`kinds.${route.kind}`)}</Badge>
              {!route.isActive && (
                <Badge variant="secondary">{t("paused")}</Badge>
              )}
              {/* Consent is set in the dialog, so without a badge the only way
                  to answer "who can see this trajet?" is to open every one. */}
              {route.isDiscoverable ? (
                <Badge variant="secondary" className="gap-1">
                  <Eye className="h-3 w-3" />
                  {t("discoverable")}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 text-muted-foreground"
                >
                  <EyeOff className="h-3 w-3" />
                  {t("notDiscoverable")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("radiusLabel", { km: route.radiusKm })}
            </p>
          </div>

          <Switch
            checked={route.isActive}
            onCheckedChange={(isActive) => onToggle(route, isActive)}
            aria-label={t("toggleActive")}
          />
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {route.originCity} ({route.originPostalCode})
            </span>
          </div>
          <div className="flex items-start gap-2">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {route.destinationCity} ({route.destinationPostalCode})
            </span>
          </div>
        </div>

        {route.kind === "recurring" ? (
          <WeekdayStrip days={route.daysOfWeek} />
        ) : (
          <TripDates dates={route.dates.map((d) => d.date)} />
        )}

        {(route.vehicle || route.capacityKg !== null) && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {route.vehicle && (
              <span className="flex items-center gap-1.5">
                <Truck className="h-4 w-4" />
                {route.vehicle.plateNumber}
              </span>
            )}
            {route.capacityKg !== null && (
              <span className="font-mono">{route.capacityKg} kg</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" className="flex-1 md:flex-none">
            <Link href={routeMatchHref(route)}>
              <Search className="h-4 w-4" />
              {t("seeMatching")}
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(route)}>
            <Pencil className="h-4 w-4" />
            {t("edit")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(route)}
          >
            <Trash2 className="h-4 w-4" />
            {t("delete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The whole week as a strip, with the days this trip runs picked out.
 *
 * The distinction between an active and an inactive day is carried by colour
 * and opacity alone, so the badges are hidden from assistive tech and the
 * container states the active days in words instead — otherwise a screen
 * reader reads all seven and conveys nothing.
 */
function WeekdayStrip({ days }: { days: number[] }) {
  const t = useTranslations("carrier.trips");

  const spoken = days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => t(`weekdaysShort.${day}`))
    .join(", ");

  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label={t("runsOn", { days: spoken })}
    >
      {ISO_WEEKDAYS.map((day) => (
        <Badge
          key={day}
          aria-hidden="true"
          variant={days.includes(day) ? "default" : "outline"}
          className={
            days.includes(day) ? undefined : "text-muted-foreground opacity-50"
          }
        >
          {t(`weekdaysShort.${day}`)}
        </Badge>
      ))}
    </div>
  );
}

/** Elapsed dates stay visible but dimmed — the trip still happened. */
function TripDates({ dates }: { dates: string[] }) {
  const today = new Date().setHours(0, 0, 0, 0);

  return (
    <div className="flex flex-wrap gap-1.5">
      {dates.map((date) => {
        const elapsed = new Date(date).setHours(0, 0, 0, 0) < today;

        return (
          <Badge
            key={date}
            variant={elapsed ? "outline" : "secondary"}
            className={elapsed ? "text-muted-foreground line-through" : undefined}
          >
            {format(new Date(date), "d MMM")}
          </Badge>
        );
      })}
    </div>
  );
}
