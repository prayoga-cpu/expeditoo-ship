"use client";

import { useState } from "react";
import { Truck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useSubmitOffer } from "../hooks/useCarrierOffers";
import type { Job } from "@/features/app/listing/types";
import { formatCurrency } from "@/lib/currency";

interface SubmitOfferFormProps {
  job: Job;
}

const euros = formatCurrency;

const toLocalInput = (iso: string) => iso.slice(0, 16);

/**
 * The carrier's side of the reverse auction.
 *
 * Vehicles too small for the load are shown but disabled, rather than hidden:
 * a carrier who cannot see why their van is missing will assume the form is
 * broken. The server re-checks capacity regardless.
 */
export function SubmitOfferForm({ job }: SubmitOfferFormProps) {
  const { data: vehicles, isLoading } = useVehicles();
  const submitOffer = useSubmitOffer(job.id);

  const [vehicleId, setVehicleId] = useState("");
  const [priceEuros, setPriceEuros] = useState(String(job.budgetCents / 100));
  const [pickup, setPickup] = useState(toLocalInput(job.pickupFrom));
  const [delivery, setDelivery] = useState(toLocalInput(job.dropoffFrom));
  const [message, setMessage] = useState("");

  if (isLoading) return null;

  if (!vehicles || vehicles.length === 0) {
    return (
      <CenteredEmptyState
        icon={Truck}
        title="Add a vehicle first"
        description="An offer names the vehicle that will do the job, so your fleet needs at least one."
      >
        <Button asChild>
          <a href="/carrier/fleet">Manage fleet</a>
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

  const priceCents = Math.round(Number(priceEuros) * 100);
  const overBudget = priceCents > job.budgetCents;
  const canSubmit =
    vehicleId && priceCents >= 100 && pickup && delivery && !submitOffer.isPending;

  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <div>
        <h2 className="font-semibold">Submit an offer</h2>
        <p className="text-sm text-muted-foreground">
          Budget {euros(job.budgetCents)}
          {job.offersCount > 0 && ` · ${job.offersCount} carrier(s) already bid`}
        </p>
      </div>

      <div>
        <Label htmlFor="vehicle">Vehicle</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger id="vehicle">
            <SelectValue placeholder="Choose a vehicle" />
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
                  {!suitable && " — too small for this load"}
                  {suitable && !vehicle.isActive && " — inactive"}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="price">Your price (€)</Label>
        <Input
          id="price"
          type="number"
          min={1}
          step="1"
          value={priceEuros}
          onChange={(e) => setPriceEuros(e.target.value)}
        />
        {overBudget && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-warning">
            <TriangleAlert className="h-3.5 w-3.5" />
            Above the shipper&apos;s budget. Allowed — explain why below.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pickup">Estimated pickup</Label>
          <Input
            id="pickup"
            type="datetime-local"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="delivery">Estimated delivery</Label>
          <Input
            id="delivery"
            type="datetime-local"
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
          />
        </div>
      </div>

      {!job.isFlexible && (
        <p className="text-sm text-muted-foreground">
          Pickup must fall between{" "}
          {new Date(job.pickupFrom).toLocaleString("fr-FR")} and{" "}
          {new Date(job.pickupUntil).toLocaleString("fr-FR")}.
        </p>
      )}

      <div>
        <Label htmlFor="message">Message (optional)</Label>
        <Textarea
          id="message"
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell the shipper why you are the right carrier for this job."
        />
      </div>

      <Button
        className="w-full"
        disabled={!canSubmit}
        onClick={() =>
          submitOffer.mutate({
            vehicleId,
            priceCents,
            estimatedPickup: new Date(pickup).toISOString(),
            estimatedDelivery: new Date(delivery).toISOString(),
            message: message || undefined,
          })
        }
      >
        {submitOffer.isPending ? "Submitting…" : "Submit offer"}
      </Button>
    </Card>
  );
}
