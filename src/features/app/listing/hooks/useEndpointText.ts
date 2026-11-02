"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { countryName, DEFAULT_COUNTRY } from "@/lib/countries";

/**
 * One end of a job, and a move's size, in words — the same on the job page,
 * the board, the summary and the driver's run
 * (client_feedback_2026_10_31_spec.md §2.4, §3, §6.4).
 */
export function useEndpointText() {
  const t = useTranslations("common.endpoint");
  const locale = useLocale();

  /** « 3ᵉ étage · sans ascenseur », « Rez-de-chaussée », or null when unsaid. */
  const floor = useCallback(
    (level: number | null | undefined, lift: boolean | null | undefined) => {
      if (level == null) return null;
      const where = level === 0 ? t("groundFloor") : t("floor", { floor: level });
      if (level === 0 || lift == null) return where;
      return `${where} · ${t(lift ? "withLift" : "withoutLift")}`;
    },
    [t]
  );

  /** The country's name, or null for France — the case nobody needs told. */
  const country = useCallback(
    (code: string | null | undefined) =>
      code && code !== DEFAULT_COUNTRY ? countryName(code, locale) : null,
    [locale]
  );

  /** « 1000 Bruxelles, Belgique »; a French town as it always read. */
  const town = useCallback(
    (postalCode: string | null | undefined, city: string, code?: string | null) => {
      const place = [postalCode, city].filter(Boolean).join(" ");
      const name = country(code);
      return name ? `${place}, ${name}` : place;
    },
    [country]
  );

  /** « Logement de 65 m² » / « Volume de 30 m³ », or null on items. */
  const moveSize = useCallback(
    (surfaceM2: number | null | undefined, volumeM3: number | null | undefined) => {
      if (volumeM3 != null) return t("volume", { volume: volumeM3 });
      if (surfaceM2 != null) return t("surface", { surface: surfaceM2 });
      return null;
    },
    [t]
  );

  return { floor, country, town, moveSize };
}
