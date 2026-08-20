"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { QuoteRow } from "@/server/dal/expedion-report.dal";

import { useExpedionQuoteAdmin } from "../hooks/useExpedionReport";

/**
 * The one lever the "storage" queue never had a dialog for, even though the
 * fields it needs — `storageFreeUntil`, `storageDailyFeeCents` — were already
 * on `adminUpdateExpedionQuoteSchema`. Extending a grace period after the
 * auction house agrees to hold a lot a few more days, or correcting a wrong
 * daily fee, meant a direct database edit; this closes that gap the same way
 * `RepriceDialog` closed it for price.
 */
export function StorageDialog({
  quote,
  onClose,
}: {
  quote: QuoteRow | null;
  onClose: () => void;
}) {
  const [freeUntil, setFreeUntil] = useState("");
  const [dailyFee, setDailyFee] = useState("");
  const { mutate, isPending } = useExpedionQuoteAdmin();
  const t = useTranslations("admin.expedion");

  useEffect(() => {
    if (!quote) return;
    setFreeUntil(
      quote.storageFreeUntil
        ? quote.storageFreeUntil.toISOString().slice(0, 10)
        : ""
    );
    // The report's lean projection carries the free-until date but not the
    // daily fee — it plays no part in any badge or sort, so it was never
    // worth adding to `QuoteRow`. Left blank rather than fetched, since a
    // blank field an operator did not touch stays untouched on save.
    setDailyFee("");
  }, [quote]);

  /** Euros as typed → cents, or null for an empty field. */
  function toCents(value: string): number | null {
    const cleaned = value.replace(",", ".").trim();
    if (cleaned === "") return null;
    const euros = Number(cleaned);
    if (!Number.isFinite(euros) || euros < 0) return null;
    return Math.round(euros * 100);
  }

  function save() {
    if (!quote) return;
    mutate(
      {
        id: quote.id,
        patch: {
          storageFreeUntil: freeUntil === "" ? null : freeUntil,
          ...(dailyFee !== "" ? { storageDailyFeeCents: toCents(dailyFee) } : {}),
          note: "Conditions de gardiennage ajustées depuis la supervision",
        },
      },
      { onSuccess: onClose }
    );
  }

  return (
    <Dialog open={quote !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("actions.storageTitle")}</DialogTitle>
          <DialogDescription>
            {t("actions.storageBody", {
              reference: quote?.reference ?? quote?.id.slice(0, 8) ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="storage-free-until">{t("actions.freeUntil")}</Label>
            <Input
              id="storage-free-until"
              type="date"
              value={freeUntil}
              onChange={(e) => setFreeUntil(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="storage-daily-fee">{t("actions.dailyFee")}</Label>
            <Input
              id="storage-daily-fee"
              inputMode="decimal"
              value={dailyFee}
              onChange={(e) => setDailyFee(e.target.value)}
              placeholder="5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? t("actions.saving") : t("actions.storageSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
