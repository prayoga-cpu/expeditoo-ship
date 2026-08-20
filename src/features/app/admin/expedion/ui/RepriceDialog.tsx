"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

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

import {
  useExpedionQuoteAdmin,
  useExpedionPriceSuggestion,
  type PriceSuggestion,
} from "../hooks/useExpedionReport";

/** The states from which `canTransition(..., "quoted")` holds. */
const PRICEABLE_STATUSES = ["pending", "awaiting_confirmation"];

/**
 * Publishes a price, which is what moves a quote out of the "to price" queue.
 *
 * Operators type euros; the column is cents. The conversion happens here, once,
 * on submit — the input never holds cents, so there is no window where a
 * mis-read field could send a figure a hundred times too large.
 *
 * Saving sets `quoteAvailable` — a price the client cannot see has not really
 * been quoted — and advances the status to `quoted`, which is what lets the
 * client accept it.
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
  const [suggestion, setSuggestion] = useState<PriceSuggestion | null>(null);
  const { mutate, isPending } = useExpedionQuoteAdmin();
  const { mutate: suggestPrice, isPending: isSuggesting } = useExpedionPriceSuggestion();
  const t = useTranslations("admin.expedion");

  // Seed from whatever is already on the quote each time one is opened.
  useEffect(() => {
    if (!quote) return;
    setStandard(quote.standardCents === null ? "" : String(quote.standardCents / 100));
    setInsured(quote.insuredCents === null ? "" : String(quote.insuredCents / 100));
    setSuggestion(null);
  }, [quote]);

  function askAi() {
    if (!quote) return;
    suggestPrice(quote.id, {
      onSuccess: (data) => {
        setStandard(String(data.standardCents / 100));
        setInsured(String(data.insuredCents / 100));
        setSuggestion(data);
      },
      onError: () => toast.error(t("actions.suggestionFailed")),
    });
  }

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
          // Publishing a price has to advance the status too. `quoteAvailable`
          // alone takes the row out of the "to price" queue while leaving it
          // `pending`, and `acceptQuote` only permits `quoted -> accepted` — so
          // the client would be shown a price they could never accept, on a
          // quote no queue was still watching.
          //
          // Only from the two states that can legally reach `quoted`: an
          // operator correcting the price of an already-accepted or paid job
          // must not drag it backwards, and `adminUpdate` would refuse anyway.
          status: PRICEABLE_STATUSES.includes(quote?.status ?? "")
            ? "quoted"
            : undefined,
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={askAi}
            disabled={isSuggesting || isPending}
          >
            {isSuggesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isSuggesting ? t("actions.suggesting") : t("actions.suggestPrice")}
          </Button>

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

          {suggestion && (
            <div className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
              <p>{suggestion.reasoning}</p>
              {suggestion.estimations.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">{t("actions.suggestionEstimated")}</p>
                  <ul className="list-disc pl-4">
                    {suggestion.estimations.map((estimation) => (
                      <li key={estimation}>{estimation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
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
