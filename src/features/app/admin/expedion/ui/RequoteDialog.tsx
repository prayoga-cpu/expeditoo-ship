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

import { formatCurrency } from "@/lib/currency";
import type { QuoteRow } from "@/server/dal/expedion-report.dal";

import { useExpedionRequote } from "../hooks/useExpedionReport";

/**
 * Unwinds a paid quote so the client can be re-quoted at a corrected price.
 *
 * The only correction path once money has landed: the price fields are locked
 * (`PRICE_LOCKED`) precisely so the recorded amount cannot drift from what
 * Stripe captured, and this returns the quote to `quoted` rather than editing
 * it in place. The client then accepts and pays the corrected figure.
 *
 * An `AlertDialog` like `EscalateDialog`, for the same reason: nothing here is
 * editable and none of it is reversible from this screen.
 *
 * The refund itself happens on the Expedion side — EXPEDITOO never took the
 * payment — which is why the copy says a refund is owed rather than done.
 */
export function RequoteDialog({
  quote,
  onClose,
}: {
  quote: QuoteRow | null;
  onClose: () => void;
}) {
  const { mutate, isPending } = useExpedionRequote();
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
          <AlertDialogTitle>{t("actions.requoteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("actions.requoteBody", {
              reference: quote?.reference ?? quote?.id.slice(0, 8) ?? "",
              price:
                quote?.priceCents != null
                  ? formatCurrency(quote.priceCents, { fractionDigits: 0 })
                  : "—",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Held open until the request resolves, so a refusal — a job
              // already with a driver, most often — is not hidden behind a
              // dialog that has already gone.
              event.preventDefault();
              confirm();
            }}
            disabled={isPending}
          >
            {isPending
              ? t("actions.requoting")
              : t("actions.requoteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
