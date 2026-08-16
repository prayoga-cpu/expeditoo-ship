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
 * Publishes a price, which is what moves a quote out of the "to price" queue.
 *
 * Operators type euros; the column is cents. The conversion happens here, once,
 * on submit — the input never holds cents, so there is no window where a
 * mis-read field could send a figure a hundred times too large.
 *
 * Saving also sets `quoteAvailable`, because a price the client cannot see has
 * not actually been quoted.
 */
export function RepriceDialog({
  quote,
  onClose,
}: {
  quote: QuoteRow | null;
  onClose: () => void;
}) {
  const [standard, setStandard] = useState("");
  const [insured, setInsured] = useState("");
  const { mutate, isPending } = useExpedionQuoteAdmin();
  const t = useTranslations("admin.expedion");

  // Seed from whatever is already on the quote each time one is opened.
  useEffect(() => {
    if (!quote) return;
    setStandard(quote.standardCents === null ? "" : String(quote.standardCents / 100));
    setInsured(quote.insuredCents === null ? "" : String(quote.insuredCents / 100));
  }, [quote]);

  /** Euros as typed → cents, or null for an empty field. */
  function toCents(value: string): number | null {
    const cleaned = value.replace(",", ".").trim();
    if (cleaned === "") return null;
    const euros = Number(cleaned);
    if (!Number.isFinite(euros) || euros < 0) return null;
    return Math.round(euros * 100);
  }

  const standardCents = toCents(standard);
  // A quote with no standard price is not publishable; ad valorem is optional.
  const canSave = standardCents !== null && !isPending;

  function save() {
    if (!quote || standardCents === null) return;
    mutate(
      {
        id: quote.id,
        patch: {
          quoteStandardCents: standardCents,
          quoteInsuredCents: toCents(insured),
          quoteAvailable: true,
          // Persisted onto the quote's timeline rather than rendered, so it is
          // written once in the language that log already uses (see the event
          // messages in expedion.service.ts) instead of in whichever locale
          // the operator happened to have selected.
          note: "Prix publié depuis la supervision",
        },
      },
      { onSuccess: onClose }
    );
  }

  return (
    <Dialog open={quote !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("actions.repriceTitle")}</DialogTitle>
          <DialogDescription>
            {t("actions.repriceBody", {
              reference: quote?.reference ?? quote?.id.slice(0, 8) ?? "",
              house: quote?.auctionHouseName ?? "—",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="reprice-standard">{t("actions.standard")}</Label>
            <Input
              id="reprice-standard"
              inputMode="decimal"
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
              placeholder="120"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reprice-insured">{t("actions.insured")}</Label>
            <Input
              id="reprice-insured"
              inputMode="decimal"
              value={insured}
              onChange={(e) => setInsured(e.target.value)}
              placeholder="145"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {isPending ? t("actions.saving") : t("actions.publishPrice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
