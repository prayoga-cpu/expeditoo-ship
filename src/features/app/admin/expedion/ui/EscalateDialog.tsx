"use client";

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
import { useTranslations } from "next-intl";

import type { QuoteRow } from "@/server/dal/expedion-report.dal";

import { useExpedionEscalate } from "../hooks/useExpedionReport";

/**
 * Publishes a quote to Expeditoo as a marketplace listing.
 *
 * An `AlertDialog` rather than the plain `Dialog` the other two use, because
 * this one is not editable and not reversible: escalation creates a real
 * listing that carriers can immediately bid on, and there is no un-escalate.
 * The confirm/cancel shape is the point.
 */
export function EscalateDialog({
  quote,
  onClose,
}: {
  quote: QuoteRow | null;
  onClose: () => void;
}) {
  const { mutate, isPending } = useExpedionEscalate();
  const t = useTranslations("admin.expedion");

  function confirm() {
    if (!quote) return;
    mutate(quote.id, { onSuccess: onClose });
  }

  return (
    <AlertDialog
      open={quote !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("actions.escalateTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("actions.escalateBody", {
              reference: quote?.reference ?? quote?.id.slice(0, 8) ?? "",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Keep the dialog up until the request resolves, so a failure —
              // a missing pickup coordinate, most often — is not hidden behind
              // an already-dismissed dialog.
              event.preventDefault();
              confirm();
            }}
            disabled={isPending}
          >
            {isPending ? t("actions.publishing") : t("actions.publish")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
