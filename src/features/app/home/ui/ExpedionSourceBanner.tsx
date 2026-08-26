"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { ExpedionWordmark } from "@/components/ui/brand-mark";
import { EXPEDION_URL } from "@/lib/constants/expedion";

/**
 * Where the work on this board comes from.
 *
 * Nothing on the driver side ever said the two products are connected. A job
 * arrives already paid for, with a budget nobody here set, because an Expedion
 * client accepted a quote and no driver took it inside the window — and a
 * driver reading the board had no way to know that, or to go and look at the
 * product that produced it. The empty state was the only place the word
 * "Expedion" appeared, which meant it showed exactly when there was nothing to
 * explain.
 *
 * `rel="noreferrer"` alongside `noopener`: Expedion is a sibling, not a
 * stranger, but a driver's board URL carries their filters and is not
 * something to hand across an origin.
 */
export function ExpedionSourceBanner() {
  const t = useTranslations("jobBoard.source");

  return (
    <a
      href={EXPEDION_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <ExpedionWordmark size={30} />
      <span className="min-w-0 flex-1 text-sm text-muted-foreground">
        {t("description")}
      </span>
      <span className="flex flex-none items-center gap-1 text-sm font-medium text-primary">
        <span className="hidden sm:inline">{t("cta")}</span>
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}
