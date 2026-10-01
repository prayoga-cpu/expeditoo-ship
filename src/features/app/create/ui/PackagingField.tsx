"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import {
  PACKAGING_SERVICES,
  isRedundantService,
  type PackagingLevel,
  type PackagingService,
} from "@/lib/cargo-packaging";
import type { JobFormApi } from "../hooks/useJobForm";
import { ToggleRow } from "./ToggleRow";

/**
 * Two questions that look alike and are not. The top row is how the item
 * already *is* (`packagingLevel`: one of the two, or neither). The bottom row
 * is what the carrier must *do* to it (`needsProtection`, `needsPackaging`:
 * either, both or neither), which is something the carrier prices. The client
 * read the first pair as the second and asked for fields that already seemed
 * to be there, so the state rows now say "Déjà…" and the service rows "À…".
 *
 * A request is kept coherent here rather than refused later. The switch turned
 * on last wins, and whatever it contradicts is turned off: an item already
 * boxed does not also need boxing (`isRedundantService`,
 * cargo_packaging_services_spec.md §2).
 */
export function PackagingField({ form }: { form: JobFormApi["form"] }) {
  const t = useTranslations("create.what");
  const { setValue, watch } = form;
  const level = watch("packagingLevel");

  const setLevel = (next: PackagingLevel | undefined) => {
    setValue("packagingLevel", next);
    for (const service of PACKAGING_SERVICES) {
      if (isRedundantService(next, service)) setValue(service, false);
    }
  };

  const setService = (service: PackagingService, on: boolean) => {
    setValue(service, on);
    if (on && isRedundantService(level, service)) {
      setValue("packagingLevel", undefined);
    }
  };

  return (
    <div role="group" aria-labelledby="packaging-label" className="space-y-2">
      <div>
        <Label id="packaging-label">{t("packaging")}</Label>
        <p className="text-sm text-muted-foreground">{t("packagingHint")}</p>
      </div>

      {/* State on the first row, services on the second, from `sm` up; one
          column below it, in the same order. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Still one `packagingLevel` field underneath, so turning one of
            these on makes the other's `checked` recompute to false on its
            own and the pair stays mutually exclusive. */}
        <ToggleRow
          id="packagingProtected"
          label={t("packagingOptions.protected.label")}
          description={t("packagingOptions.protected.description")}
          checked={level === "protected"}
          onChange={(on) => setLevel(on ? "protected" : undefined)}
        />
        <ToggleRow
          id="packagingBoxed"
          label={t("packagingOptions.boxed.label")}
          description={t("packagingOptions.boxed.description")}
          checked={level === "boxed"}
          onChange={(on) => setLevel(on ? "boxed" : undefined)}
        />
        <ToggleRow
          id="needsProtection"
          label={t("serviceOptions.needsProtection.label")}
          description={t("serviceOptions.needsProtection.description")}
          checked={Boolean(watch("needsProtection"))}
          onChange={(on) => setService("needsProtection", on)}
        />
        <ToggleRow
          id="needsPackaging"
          label={t("serviceOptions.needsPackaging.label")}
          description={t("serviceOptions.needsPackaging.description")}
          checked={Boolean(watch("needsPackaging"))}
          onChange={(on) => setService("needsPackaging", on)}
        />
      </div>
    </div>
  );
}
