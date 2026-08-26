"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { useVehicles } from "@/features/app/carrier/hooks/useCarrier";
import { useTakeJob } from "../hooks/useCarrierOffers";
import type { Job } from "@/features/app/listing/types";

interface TakeJobPanelProps {
  job: Job;
}

/**
 * Take the job now, at the posted budget, instead of bidding and waiting.
 *
 * No price input: the amount is the listing's budget and is read server-side,
 * so there is nothing here for a caller to name. That is deliberate — the whole
 * difference between this and an offer is that there is no negotiation.
 *
 * A vehicle is still chosen, because an offer names the vehicle that will do
 * the job and the server refuses one that cannot carry the load. Vehicles that
 * do not fit are shown disabled rather than hidden, so a carrier can see why
 * their van is not an option.
 */
export function TakeJobPanel({ job }: TakeJobPanelProps) {
  const t = useTranslations("listing.bid");
  const { data: vehicles } = useVehicles();
  const takeJob = useTakeJob(job.id);
  const [vehicleId, setVehicleId] = useState("");

  if (!vehicles || vehicles.length === 0) return null;

  const fits = (v: (typeof vehicles)[number]) =>
    v.maxWeightKg >= (job.weightKg ?? 0);

  const usable = vehicles.filter(fits);
  if (usable.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold">{t("takeJobTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("takeJobDescription", {
                price: formatCurrency(job.budgetCents),
              })}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="take-vehicle">{t("takeJobVehicle")}</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger id="take-vehicle">
                <SelectValue placeholder={t("takeJobVehiclePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id} disabled={!fits(v)}>
                    {v.plateNumber} · {v.maxWeightKg} kg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={!vehicleId || takeJob.isPending}
            onClick={() => takeJob.mutate({ vehicleId })}
          >
            {takeJob.isPending ? t("taking") : t("takeJobCta")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{t("takeJobFootnote")}</p>
      </div>
    </Card>
  );
}
