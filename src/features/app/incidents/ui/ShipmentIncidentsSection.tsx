"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useShipmentIncidents } from "../hooks/useIncidents";
import { IncidentList } from "./IncidentList";
import { ReportIncidentDialog } from "./ReportIncidentDialog";

interface ShipmentIncidentsSectionProps {
  shipmentId: string;
  /**
   * A finished run's disputes are a billing matter, so the button goes away —
   * the server refuses it too (incident_reporting_spec.md §2.1). The list
   * stays: what was reported on a delivered run is still worth reading.
   */
  canReport: boolean;
}

/**
 * The whole feature as one drop-in block: the button, and what has already
 * been reported. Both the client's screen and the transporter's mount this
 * same component, so neither can drift from the other.
 */
export function ShipmentIncidentsSection({
  shipmentId,
  canReport,
}: ShipmentIncidentsSectionProps) {
  const t = useTranslations("incidents");
  const { incidents, isLoading, isError } = useShipmentIncidents(shipmentId);

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("section.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("section.subtitle")}
          </p>
        </div>
        {canReport && <ReportIncidentDialog shipmentId={shipmentId} />}
      </div>

      <Separator />

      <IncidentList
        incidents={incidents}
        isLoading={isLoading}
        isError={isError}
      />
    </Card>
  );
}
