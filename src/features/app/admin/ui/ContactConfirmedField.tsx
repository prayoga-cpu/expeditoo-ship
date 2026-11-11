"use client";

import { useState } from "react";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CarrierApplication } from "../api/carriers.api";

/**
 * « Contact confirmé »: an operator records that they have reached the
 * applicant — who ticked it and when. Informational: it gates nothing, and
 * approval stays a separate, manual decision (client feedback 2026-11-06, C02).
 *
 * Holds its own state: the dialog keeps the application it was opened with, so
 * the tick would otherwise not show until the list reloads.
 */
export function ContactConfirmedField({
  application,
  onSet,
  disabled,
}: {
  application: CarrierApplication;
  onSet: (input: { id: string; confirmed: boolean }) => Promise<unknown>;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.carriers.detail.contactConfirmed");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  const [state, setState] = useState<{ at: string | null; by: string | null }>({
    at: application.contactConfirmedAt ?? null,
    by: application.contactConfirmer?.name ?? null,
  });
  const [pending, setPending] = useState(false);

  const toggle = async (confirmed: boolean) => {
    setPending(true);
    try {
      await onSet({ id: application.id, confirmed });
      // The name is known from the list on a reload; here it is "you".
      setState(confirmed ? { at: new Date().toISOString(), by: null } : { at: null, by: null });
    } catch {
      // The hook toasts the refusal; the tick stays where it was.
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Checkbox
        id={`contact-confirmed-${application.id}`}
        checked={state.at !== null}
        disabled={disabled || pending}
        onCheckedChange={(checked) => void toggle(checked === true)}
        className="mt-0.5"
      />
      <div className="space-y-0.5">
        <Label htmlFor={`contact-confirmed-${application.id}`} className="cursor-pointer">
          {t("label")}
        </Label>
        <p className="text-muted-foreground text-xs">
          {state.at
            ? t("confirmedOn", {
                date: format(new Date(state.at), "dd MMMM yyyy", { locale: dateLocale }),
                by: state.by ?? t("you"),
              })
            : t("hint")}
        </p>
      </div>
    </div>
  );
}
