"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Route } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCarrierRoutes,
  useDeleteCarrierRoute,
  useSaveCarrierRoute,
  useToggleCarrierRoute,
} from "../hooks/useCarrierTrips";
import { useVehicles } from "../hooks/useCarrier";
import { TripRouteCard } from "./TripRouteCard";
import { TripRouteFormDialog } from "./TripRouteFormDialog";
import type { CarrierRoute, CarrierRouteInput } from "../api/trips.api";

/**
 * The trips a carrier declares: the routes they already drive, recurring or on
 * specific dates. Private to them — this is a saved query against the board,
 * not an offer (carrier_trips_spec.md §9).
 */
export function PlannedTripsPanel() {
  const t = useTranslations("carrier.trips");
  const { data, isLoading, error } = useCarrierRoutes();
  const { data: vehicles } = useVehicles();
  const save = useSaveCarrierRoute();
  const remove = useDeleteCarrierRoute();
  const toggle = useToggleCarrierRoute();

  const [editing, setEditing] = useState<CarrierRoute | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CarrierRoute | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (route: CarrierRoute) => {
    setEditing(route);
    setFormOpen(true);
  };

  const submit = (input: CarrierRouteInput) =>
    save.mutate(
      { id: editing?.id, input },
      { onSuccess: () => setFormOpen(false) }
    );

  if (isLoading) return <PageLoader className="xl:min-h-[50vh]" />;

  const routes = data?.items ?? [];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" />
          {t("add")}
        </Button>
      </div>

      {/* A signed-in user with no carrier record reaches this screen through
          the sidebar; the API answers CARRIER_NOT_FOUND rather than an empty
          list, so it is a state to explain, not a crash. */}
      {error ? (
        <CenteredEmptyState
          icon={Route}
          title={t("noCarrier.title")}
          description={t("noCarrier.description")}
        />
      ) : routes.length === 0 ? (
        <CenteredEmptyState
          icon={Route}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {routes.map((route) => (
            <TripRouteCard
              key={route.id}
              route={route}
              onEdit={openEdit}
              onDelete={setPendingDelete}
              onToggle={(target, isActive) =>
                toggle.mutate({ id: target.id, isActive })
              }
            />
          ))}
        </div>
      )}

      <TripRouteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        route={editing}
        vehicles={vehicles ?? []}
        isSaving={save.isPending}
        onSubmit={submit}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("deleteConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              {t("deleteConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
