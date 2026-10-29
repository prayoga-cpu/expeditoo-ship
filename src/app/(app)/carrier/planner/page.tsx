"use client";

import { useTranslations } from "next-intl";
import { RoutePlanner } from "@/features/app/carrier/ui/RoutePlanner";

/** « Planificateur de tournée » — client_feedback_2026_10_29_spec.md §N8. */
export default function CarrierPlannerPage() {
  const t = useTranslations("carrier.planner");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <RoutePlanner />
    </div>
  );
}
