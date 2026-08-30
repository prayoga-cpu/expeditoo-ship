"use client";

import { useEffect, useState } from "react";
import { Truck, TriangleAlert, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { useVehicles } from "@/features/app/carrier/hooks/useCarrier";
import { formatCurrency } from "@/lib/currency";
import { TIME_SLOTS, type TimeSlot } from "@/lib/availability-window";
import type { ThreadOfferContext } from "../types";
import { useThreadOffer } from "../hooks/useThreadOffer";
import { ThreadOfferSlotField } from "./ThreadOfferSlotField";

interface ThreadOfferDialogProps {
  conversationId: string;
  context: ThreadOfferContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The form behind the button in the composer.
 *
 * Field-for-field the job page's `SubmitOfferForm`, because on the job lane it
 * must satisfy the same `createOfferSchema` - with one difference that is the
 * whole point: one pickup slot, not up to twelve.
 *
 * On the standalone lane there is no job, so the vehicle field is omitted
 * rather than shown empty: an offer names the vehicle that will do *a job*,
 * and there is none to fit.
 */
export function ThreadOfferDialog({
  conversationId,
  context,
  open,
  onOpenChange,
}: ThreadOfferDialogProps) {
  const t = useTranslations("messages.offer");
  const tForm = useTranslations("listing.bid.form");
  const job = context.job;
  const isJobLane = context.lane === "job" && job !== null;

  const { data: vehicles, isLoading, isError, refetch } = useVehicles();
  const { submit } = useThreadOffer(conversationId);

  const [vehicleId, setVehicleId] = useState("");
  const [priceEuros, setPriceEuros] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<TimeSlot>(TIME_SLOTS[0]);
  const [deliveryLeadDays, setDeliveryLeadDays] = useState(0);
  const [message, setMessage] = useState("");

  // Reset when the dialog opens, so a cancelled draft never resurfaces.
  useEffect(() => {
    if (!open) return;
    setVehicleId("");
    setPriceEuros(job ? String(job.budgetCents / 100) : "");
    setDay(null);
    setSlot(TIME_SLOTS[0]);
    setDeliveryLeadDays(0);
    setMessage("");
  }, [open, job]);

  const priceCents = Math.round(Number(priceEuros) * 100);
  const overBudget = job ? priceCents > job.budgetCents : false;
  const canSubmit =
    Number.isFinite(priceCents) &&
    priceCents >= 100 &&
    day !== null &&
    (!isJobLane || vehicleId !== "") &&
    !submit.isPending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !day) return;
    submit.mutate(
      {
        priceCents,
        pickupDay: day,
        pickupSlot: slot,
        deliveryLeadDays,
        tzOffset: new Date().getTimezoneOffset(),
        vehicleId: isJobLane ? vehicleId : undefined,
        message: message.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>
            {job
              ? t("dialogDescriptionJob", {
                  title: job.title,
                  price: formatCurrency(job.budgetCents),
                })
              : t("dialogDescriptionStandalone")}
          </DialogDescription>
        </DialogHeader>

        {isJobLane && renderFleetGate()}

        {(!isJobLane || fleetReady()) && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {isJobLane && vehicles && (
              <div className="space-y-2">
                <Label htmlFor="thread-offer-vehicle">{tForm("vehicle")}</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger id="thread-offer-vehicle">
                    <SelectValue placeholder={tForm("vehiclePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => {
                      const suitable = fits(vehicle);
                      return (
                        <SelectItem
                          key={vehicle.id}
                          value={vehicle.id}
                          disabled={!suitable || !vehicle.isActive}
                        >
                          {vehicle.plateNumber} ·{" "}
                          {[vehicle.make, vehicle.model]
                            .filter(Boolean)
                            .join(" ") || vehicle.type.replace(/_/g, " ")}
                          {!suitable && ` — ${tForm("vehicleTooSmall")}`}
                          {suitable &&
                            !vehicle.isActive &&
                            ` — ${tForm("vehicleInactive")}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="thread-offer-price">{tForm("price")}</Label>
              <Input
                id="thread-offer-price"
                type="number"
                min={1}
                step="1"
                inputMode="decimal"
                value={priceEuros}
                onChange={(e) => setPriceEuros(e.target.value)}
              />
              {overBudget && (
                <p className="flex items-center gap-1.5 text-sm text-warning">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                  {tForm("overBudget")}
                </p>
              )}
            </div>

            <ThreadOfferSlotField
              day={day}
              onDayChange={setDay}
              slot={slot}
              onSlotChange={setSlot}
              deliveryLeadDays={deliveryLeadDays}
              onDeliveryLeadChange={setDeliveryLeadDays}
              window={
                job
                  ? {
                      from: new Date(job.pickupFrom),
                      until: new Date(job.pickupUntil),
                      isFlexible: job.isFlexible,
                    }
                  : undefined
              }
            />

            <div className="space-y-2">
              <Label htmlFor="thread-offer-message">{tForm("message")}</Label>
              <Textarea
                id="thread-offer-message"
                rows={3}
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={tForm("messagePlaceholder")}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submit.isPending ? tForm("submitting") : t("send")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );

  function fleetReady() {
    return !isLoading && !isError && vehicles && vehicles.length > 0;
  }

  /**
   * A failing fleet fetch is told apart from an empty one on purpose:
   * `GET /api/carrier/vehicles` answers 404 for a user with no carrier row,
   * which React Query surfaces as `undefined` - indistinguishable from "no
   * vehicles yet" unless the error branch is explicit (CLAUDE.md gotcha 9).
   */
  function renderFleetGate() {
    if (isLoading) return null;

    if (isError) {
      return (
        <CenteredEmptyState
          icon={RotateCw}
          title={t("fleetErrorTitle")}
          description={t("fleetErrorDescription")}
        >
          <Button variant="outline" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </CenteredEmptyState>
      );
    }

    if (!vehicles || vehicles.length === 0) {
      return (
        <CenteredEmptyState
          icon={Truck}
          title={tForm("noVehicleTitle")}
          description={tForm("noVehicleDescription")}
        >
          <Button asChild>
            <a href="/carrier/fleet">{tForm("noVehicleCta")}</a>
          </Button>
        </CenteredEmptyState>
      );
    }

    return null;
  }

  /**
   * Vehicles too small for the load are shown but disabled rather than hidden:
   * a carrier who cannot see why their van is missing assumes the form is
   * broken. The server re-checks capacity regardless.
   */
  function fits(vehicle: NonNullable<typeof vehicles>[number]) {
    if (!job) return true;
    if (vehicle.maxWeightKg < job.weightKg) return false;
    const pairs: [number | null, number | null][] = [
      [job.lengthCm, vehicle.maxLengthCm],
      [job.widthCm, vehicle.maxWidthCm],
      [job.heightCm, vehicle.maxHeightCm],
    ];
    return pairs.every(([need, have]) =>
      need != null && have != null ? have >= need : true
    );
  }
}
