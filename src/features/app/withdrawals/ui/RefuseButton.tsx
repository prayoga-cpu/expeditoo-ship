"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import type { ReviewRow } from "../api/withdrawals.api";

interface RefuseButtonProps {
  row: ReviewRow;
  disabled: boolean;
  onRefuse: () => void;
  /** The confirmation's open state, when the caller holds it (tests do). */
  confirmOpen?: boolean;
  onConfirmOpenChange?: (open: boolean) => void;
}

/**
 * Refuse, on a request still waiting or already approved.
 *
 * A waiting request has had no transfer — none is made before approval — so
 * refusing it goes straight through. An approved one may already have been
 * paid by hand, and refusing it puts that money back in the driver's balance,
 * where their next request claims it again: the same deliveries paid twice. So
 * that one asks first, and says so (payout_safety_spec.md §4).
 */
export function RefuseButton({
  row,
  disabled,
  onRefuse,
  confirmOpen,
  onConfirmOpenChange,
}: RefuseButtonProps) {
  const t = useTranslations("withdrawals");
  const [ownOpen, setOwnOpen] = useState(false);
  const open = confirmOpen ?? ownOpen;
  const setOpen = onConfirmOpenChange ?? setOwnOpen;
  const approved = row.status === "approved";

  const button = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={approved ? undefined : onRefuse}
    >
      {t("reject")}
    </Button>
  );
  if (!approved) return button;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("refuseApproved.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("refuseApproved.description", {
              amount: formatCurrency(row.amountCents),
              name: row.carrierName ?? row.carrierEmail,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("refuseApproved.keep")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={onRefuse}
          >
            {t("refuseApproved.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
