"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LocationPickerField,
  type LocationPickerValue,
} from "@/components/ui/location-picker-field";
import type { Vehicle } from "../api/carrier.api";
import type {
  CarrierRoute,
  CarrierRouteInput,
  CarrierRouteKind,
} from "../api/trips.api";

const EMPTY_POINT: LocationPickerValue = {
  address: "",
  city: "",
  postalCode: "",
  lat: null,
  lng: null,
};

const NO_VEHICLE = "none";
const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

interface FormState {
  label: string;
  kind: CarrierRouteKind;
  origin: LocationPickerValue;
  destination: LocationPickerValue;
  radiusKm: number;
  daysOfWeek: number[];
  /** `yyyy-mm-dd`, the value a native date input produces. */
  dates: string[];
  vehicleId: string;
  capacityKg: string;
  notifyOnMatch: boolean;
  isActive: boolean;
  isDiscoverable: boolean;
}

const blankForm = (): FormState => ({
  label: "",
  kind: "recurring",
  origin: EMPTY_POINT,
  destination: EMPTY_POINT,
  radiusKm: 50,
  daysOfWeek: [],
  dates: [],
  vehicleId: NO_VEHICLE,
  capacityKg: "",
  notifyOnMatch: true,
  isActive: true,
  isDiscoverable: true,
});

function formFromRoute(route: CarrierRoute): FormState {
  return {
    label: route.label ?? "",
    kind: route.kind,
    origin: {
      address: route.originAddress,
      city: route.originCity,
      postalCode: route.originPostalCode,
      lat: route.originLat,
      lng: route.originLng,
    },
    destination: {
      address: route.destinationAddress,
      city: route.destinationCity,
      postalCode: route.destinationPostalCode,
      lat: route.destinationLat,
      lng: route.destinationLng,
    },
    radiusKm: route.radiusKm,
    daysOfWeek: route.daysOfWeek,
    dates: route.dates.map((d) => d.date.slice(0, 10)),
    vehicleId: route.vehicleId ?? NO_VEHICLE,
    capacityKg: route.capacityKg === null ? "" : String(route.capacityKg),
    notifyOnMatch: route.notifyOnMatch,
    isActive: route.isActive,
    isDiscoverable: route.isDiscoverable,
  };
}

/** The picker leaves lat/lng null until a pin drops; the API will not. */
function isComplete(form: FormState): boolean {
  const pinned = (point: LocationPickerValue) =>
    Boolean(point.address && point.city && point.postalCode && point.lat !== null);

  if (!pinned(form.origin) || !pinned(form.destination)) return false;
  if (form.kind === "recurring") return form.daysOfWeek.length > 0;
  return form.dates.length > 0;
}

function toInput(form: FormState): CarrierRouteInput {
  const point = (value: LocationPickerValue) => ({
    address: value.address,
    city: value.city,
    postalCode: value.postalCode,
    lat: value.lat as number,
    lng: value.lng as number,
  });

  const capacity = Number.parseFloat(form.capacityKg);

  return {
    label: form.label.trim() || undefined,
    kind: form.kind,
    origin: point(form.origin),
    destination: point(form.destination),
    radiusKm: form.radiusKm,
    // Only the field the kind allows travels; the server rejects the other.
    daysOfWeek: form.kind === "recurring" ? form.daysOfWeek : undefined,
    dates:
      form.kind === "occasional"
        ? form.dates.map((d) => new Date(`${d}T00:00:00`).toISOString())
        : undefined,
    vehicleId: form.vehicleId === NO_VEHICLE ? null : form.vehicleId,
    capacityKg: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
    notifyOnMatch: form.notifyOnMatch,
    isActive: form.isActive,
    isDiscoverable: form.isDiscoverable,
  };
}

interface TripRouteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: CarrierRoute | null;
  vehicles: Vehicle[];
  isSaving: boolean;
  onSubmit: (input: CarrierRouteInput) => void;
}

/**
 * Declaring a trip. The two endpoints go through the shared
 * `LocationPickerField` — it already searches Nominatim, drags a pin,
 * reverse-geocodes and refuses anywhere outside France, in both languages and
 * both themes.
 */
export function TripRouteFormDialog({
  open,
  onOpenChange,
  route,
  vehicles,
  isSaving,
  onSubmit,
}: TripRouteFormDialogProps) {
  const t = useTranslations("carrier.trips.form");
  const [form, setForm] = useState<FormState>(blankForm);
  const [pendingDate, setPendingDate] = useState("");

  // Reopening for a different trip must not show the previous one's answers.
  useEffect(() => {
    if (!open) return;
    setForm(route ? formFromRoute(route) : blankForm());
    setPendingDate("");
  }, [open, route]);

  const patch = (next: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...next }));

  const addDate = () => {
    if (!pendingDate || form.dates.includes(pendingDate)) return;
    patch({ dates: [...form.dates, pendingDate].sort() });
    setPendingDate("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{route ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="trip-label">{t("label")}</Label>
            <Input
              id="trip-label"
              value={form.label}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder={t("labelPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("kind")}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={form.kind}
              onValueChange={(value) =>
                value && patch({ kind: value as CarrierRouteKind })
              }
              className="w-full"
            >
              <ToggleGroupItem value="recurring" className="flex-1">
                {t("kinds.recurring")}
              </ToggleGroupItem>
              <ToggleGroupItem value="occasional" className="flex-1">
                {t("kinds.occasional")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("origin")}</Label>
              <LocationPickerField
                id="trip-origin"
                value={form.origin}
                onChange={(origin) => patch({ origin })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("destination")}</Label>
              <LocationPickerField
                id="trip-destination"
                value={form.destination}
                onChange={(destination) => patch({ destination })}
              />
            </div>
          </div>

          {form.kind === "recurring" ? (
            <WeekdayPicker
              value={form.daysOfWeek}
              onChange={(daysOfWeek) => patch({ daysOfWeek })}
            />
          ) : (
            <DateList
              dates={form.dates}
              pending={pendingDate}
              onPendingChange={setPendingDate}
              onAdd={addDate}
              onRemove={(date) =>
                patch({ dates: form.dates.filter((d) => d !== date) })
              }
            />
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("radius")}</Label>
              <span className="font-mono text-sm text-muted-foreground">
                {form.radiusKm} km
              </span>
            </div>
            <Slider
              min={5}
              max={300}
              step={5}
              value={[form.radiusKm]}
              onValueChange={([radiusKm]) => patch({ radiusKm })}
            />
            <p className="text-xs text-muted-foreground">{t("radiusHint")}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("vehicle")}</Label>
              <Select
                value={form.vehicleId}
                onValueChange={(vehicleId) => patch({ vehicleId })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("vehiclePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VEHICLE}>{t("noVehicle")}</SelectItem>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.plateNumber} · {vehicle.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trip-capacity">{t("capacity")}</Label>
              <Input
                id="trip-capacity"
                type="number"
                min={0}
                inputMode="decimal"
                value={form.capacityKg}
                onChange={(e) => patch({ capacityKg: e.target.value })}
                placeholder={t("capacityPlaceholder")}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="trip-notify">{t("notify")}</Label>
              <p className="text-xs text-muted-foreground">{t("notifyHint")}</p>
            </div>
            <Switch
              id="trip-notify"
              checked={form.notifyOnMatch}
              onCheckedChange={(notifyOnMatch) => patch({ notifyOnMatch })}
            />
          </div>

          {/* The hint spells the disclosure out in full because this is the
              only place the carrier consents to it, and the trajets declared
              before the switch existed were promised « Vous seul le voyez »
              (carriers_on_route_spec.md §4). */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="trip-discoverable">{t("discoverableLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("discoverableHint")}
              </p>
            </div>
            <Switch
              id="trip-discoverable"
              checked={form.isDiscoverable}
              onCheckedChange={(isDiscoverable) => patch({ isDiscoverable })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!isComplete(form) || isSaving}
            onClick={() => onSubmit(toInput(form))}
          >
            {route ? t("save") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const t = useTranslations("carrier.trips");

  return (
    <div className="space-y-2">
      <Label>{t("form.days")}</Label>
      <ToggleGroup
        type="multiple"
        variant="outline"
        value={value.map(String)}
        onValueChange={(days) => onChange(days.map(Number).sort())}
        className="w-full flex-wrap"
      >
        {ISO_WEEKDAYS.map((day) => (
          <ToggleGroupItem key={day} value={String(day)} className="flex-1">
            {t(`weekdaysShort.${day}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function DateList({
  dates,
  pending,
  onPendingChange,
  onAdd,
  onRemove,
}: {
  dates: string[];
  pending: string;
  onPendingChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (date: string) => void;
}) {
  const t = useTranslations("carrier.trips.form");

  return (
    <div className="space-y-2">
      <Label htmlFor="trip-date">{t("dates")}</Label>
      <div className="flex gap-2">
        <Input
          id="trip-date"
          type="date"
          value={pending}
          onChange={(e) => onPendingChange(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {t("addDate")}
        </Button>
      </div>

      {dates.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {dates.map((date) => (
            <Badge key={date} variant="secondary" className="gap-1 font-mono">
              {date}
              <button
                type="button"
                onClick={() => onRemove(date)}
                aria-label={t("removeDate")}
                className="ml-1 rounded-sm hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
