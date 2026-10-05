"use client";

import { useState } from "react";
import { Truck, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
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
import { useSubmitOffer } from "../hooks/useCarrierOffers";
import { OfferSlotsField } from "./OfferSlotsField";
import { useAvailabilityText } from "@/features/app/listing/ui/AvailabilityLine";
import type { Job } from "@/features/app/listing/types";
import type { OfferSlotInput } from "@/lib/offer-slots";
import { formatCurrency } from "@/lib/currency";
import {
  NUMERIC_RULES,
  centsToInput,
  parseCents,
} from "@/lib/numeric-input";

interface SubmitOfferFormProps {
  job: Job;
}

const euros = formatCurrency;

/**
 * The carrier's side of the reverse auction.
 *
 * Vehicles too small for the load are shown but disabled, rather than hidden:
 * a carrier who cannot see why their van is missing will assume the form is
 * broken. The server re-checks capacity regardless.
 *
 * Timing is a set of proposed slots rather than one datetime — a driver free on
 * the 25th or the 27th should be able to say both, and whoever awards the job
 * books one of them (offer_time_slots_spec.md).
 */
export function SubmitOfferForm({ job }: SubmitOfferFormProps) {
  const t = useTranslations("listing.bid.form");
  const locale = useLocale();
  const { data: vehicles, isLoading } = useVehicles();
  const submitOffer = useSubmitOffer(job.id);

  const [vehicleId, setVehicleId] = useState("");
  // The budget as the box shows money — « 89,90 » in French, where
  // `String(cents / 100)` wrote « 89.9 » (numeric_input_spec.md §6).
  const [priceEuros, setPriceEuros] = useState(() =>
    centsToInput(job.budgetCents, locale)
  );
  const [slots, setSlots] = useState<OfferSlotInput[]>([]);
  const [deliveryLeadDays, setDeliveryLeadDays] = useState(0);
  const [message, setMessage] = useState("");
  // The requester's weekdays and times of day for the pickup, right where the
  // carrier picks slots. A preference: a flexible job still takes slots
  // outside it (request_availability_spec.md §6–7).
  const pickupPreference = useAvailabilityText(job.pickupDays, job.pickupPeriods);

  if (isLoading) return null;

  if (!vehicles || vehicles.length === 0) {
    return (
      <CenteredEmptyState
        icon={Truck}
        title={t("noVehicleTitle")}
        description={t("noVehicleDescription")}
      >
        <Button asChild>
          <a href="/carrier/fleet">{t("noVehicleCta")}</a>
        </Button>
      </CenteredEmptyState>
    );
  }

  const fits = (v: (typeof vehicles)[number]) => {
    if (v.maxWeightKg < job.weightKg) return false;
    const pairs: [number | null, number | null][] = [
      [job.lengthCm, v.maxLengthCm],
      [job.widthCm, v.maxWidthCm],
      [job.heightCm, v.maxHeightCm],
    ];
    return pairs.every(([need, have]) =>
      need != null && have != null ? have >= need : true
    );
  };

  // Read on the digits, so « 40,05 » is 4005 cents and a blank box is none.
  const priceCents = parseCents(priceEuros);
  const overBudget = priceCents !== null && priceCents > job.budgetCents;
  const canSubmit =
    vehicleId &&
    priceCents !== null &&
    priceCents >= 100 &&
    slots.length > 0 &&
    !submitOffer.isPending;

  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <div>
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("budget", { price: euros(job.budgetCents) })}
          {job.offersCount > 0 &&
            ` · ${t("rivals", { count: job.offersCount })}`}
        </p>
      </div>

      <div>
        <Label htmlFor="vehicle">{t("vehicle")}</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger id="vehicle">
            <SelectValue placeholder={t("vehiclePlaceholder")} />
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
                  {[vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
                    vehicle.type.replace(/_/g, " ")}
                  {!suitable && ` — ${t("vehicleTooSmall")}`}
                  {suitable && !vehicle.isActive && ` — ${t("vehicleInactive")}`}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="price">{t("price")}</Label>
        <NumericInput
          id="price"
          rules={NUMERIC_RULES.MONEY}
          value={priceEuros}
          onChange={(e) => setPriceEuros(e.target.value)}
        />
        {overBudget && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-warning">
            <TriangleAlert className="h-3.5 w-3.5" />
            {t("overBudget")}
          </p>
        )}
      </div>

      {pickupPreference && (
        <p className="text-sm text-muted-foreground">
          {t("pickupPreference", { value: pickupPreference })}
        </p>
      )}

      <OfferSlotsField
        slots={slots}
        onSlotsChange={setSlots}
        deliveryLeadDays={deliveryLeadDays}
        onDeliveryLeadChange={setDeliveryLeadDays}
        window={{
          from: new Date(job.pickupFrom),
          until: new Date(job.pickupUntil),
          isFlexible: job.isFlexible,
        }}
      />

      <div>
        <Label htmlFor="message">{t("message")}</Label>
        <Textarea
          id="message"
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("messagePlaceholder")}
        />
      </div>

      <Button
        className="w-full"
        disabled={!canSubmit}
        onClick={() =>
          priceCents !== null &&
          submitOffer.mutate({
            vehicleId,
            priceCents,
            slots,
            deliveryLeadDays,
            // Resolved server-side into instants, so "matin" is the driver's
            // morning and not the (UTC) server's.
            tzOffset: new Date().getTimezoneOffset(),
            message: message || undefined,
          })
        }
      >
        {submitOffer.isPending ? t("submitting") : t("submit")}
      </Button>
    </Card>
  );
}
