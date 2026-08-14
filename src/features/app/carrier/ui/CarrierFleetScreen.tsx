"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import {
  useCarrierApplication,
  useDeleteVehicle,
  useToggleVehicleActive,
  useVehicles,
} from "../hooks/useCarrier";
import type { Vehicle } from "../api/carrier.api";
import { VehicleForm } from "./VehicleForm";

/** The carrier's fleet: list, add, activate/deactivate, remove. */
export function CarrierFleetScreen() {
  const { data: application, isLoading: applicationLoading } =
    useCarrierApplication();
  const { data: vehicles, isLoading: vehiclesLoading } = useVehicles();
  const [adding, setAdding] = useState(false);
  const t = useTranslations("carrier.fleet");

  if (applicationLoading || vehiclesLoading) return <PageLoader />;

  if (!application) return <NeedApplicationState />;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("addVehicle")}
          </Button>
        )}
      </div>

      {adding && <VehicleForm onDone={() => setAdding(false)} />}

      {!adding && (!vehicles || vehicles.length === 0) ? (
        <CenteredEmptyState
          icon={Truck}
          title={t("empty.title")}
          description={t("empty.description")}
          variant="page"
        >
          <Button onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("addVehicle")}
          </Button>
        </CenteredEmptyState>
      ) : (
        <div className="space-y-3">
          {vehicles?.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      )}
    </div>
  );
}

function NeedApplicationState() {
  const t = useTranslations("carrier.fleet.needApplication");

  return (
    <CenteredEmptyState
      icon={Truck}
      title={t("title")}
      description={t("description")}
      variant="page"
    >
      <Button asChild>
        <Link href="/carrier/application">{t("cta")}</Link>
      </Button>
    </CenteredEmptyState>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const t = useTranslations("carrier.fleet");
  const toggle = useToggleVehicleActive();
  const remove = useDeleteVehicle();

  const makeModel = [vehicle.make, vehicle.model, vehicle.year]
    .filter(Boolean)
    .join(" ");

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{t(`types.${vehicle.type}`)}</p>
            <Badge
              className={
                vehicle.isActive
                  ? "bg-success/15 text-success border-success/30"
                  : "bg-muted text-muted-foreground border-border"
              }
            >
              {vehicle.isActive ? t("active") : t("inactive")}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-sm">{vehicle.plateNumber}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {makeModel ? `${makeModel} · ` : ""}
            {t("capacity", { kg: vehicle.maxWeightKg })}
            <VehicleDimensions vehicle={vehicle} />
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={toggle.isPending}
            onClick={() =>
              toggle.mutate({ id: vehicle.id, isActive: !vehicle.isActive })
            }
          >
            {vehicle.isActive ? t("deactivate") : t("activate")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate(vehicle.id)}
          >
            {t("remove")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function VehicleDimensions({ vehicle }: { vehicle: Vehicle }) {
  const t = useTranslations("carrier.fleet");

  if (!vehicle.maxLengthCm || !vehicle.maxWidthCm || !vehicle.maxHeightCm) {
    return null;
  }

  return (
    <>
      {" · "}
      {t("dimensions", {
        length: vehicle.maxLengthCm,
        width: vehicle.maxWidthCm,
        height: vehicle.maxHeightCm,
      })}
    </>
  );
}
