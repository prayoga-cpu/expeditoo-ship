"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, MessageSquareReply } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/currency";
import { NUMERIC_RULES, parseCents } from "@/lib/numeric-input";
import {
  MAX_COUNTER_ROUNDS,
  MAX_OFFER_CENTS,
  MIN_OFFER_CENTS,
} from "@/server/dto/offers.dto";
import { useCounterOffer, useProposeOffer } from "@/features/app/offers/hooks/useNegotiation";
import type { Offer } from "../types";

/**
 * What a requester and an operator can do with one pending offer besides
 * accepting it (client_feedback_2026_10_29_spec.md §B1, §B6).
 *
 * - The operator recommends it — « Proposer au client » — and the requester
 *   still pays to confirm in the accept dialog: nobody's card moves here.
 * - The requester sends a price back — « Contre-proposition » — and reads the
 *   carrier's answer as the offer's new price. One counter-price at a time.
 */
export function OfferNegotiation({
  offer,
  canPropose,
  canCounter,
}: {
  offer: Offer;
  canPropose: boolean;
  canCounter: boolean;
}) {
  const t = useTranslations("negotiation");
  const propose = useProposeOffer();
  const counter = useCounterOffer();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  if (offer.status !== "pending") return null;

  const pendingCounter = offer.counterPriceCents !== null;
  const roundsLeft = MAX_COUNTER_ROUNDS - offer.counterRounds;
  const cents = parseCents(price);
  const priceValid =
    cents !== null &&
    cents >= MIN_OFFER_CENTS &&
    cents <= MAX_OFFER_CENTS &&
    cents !== offer.priceCents;

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      {pendingCounter && (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MessageSquareReply className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t("counterWaiting", { price: formatCurrency(offer.counterPriceCents!) })}
        </p>
      )}

      {open && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`counter-${offer.id}`}>{t("counterPrice")}</Label>
            <NumericInput
              id={`counter-${offer.id}`}
              rules={NUMERIC_RULES.MONEY}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`counter-note-${offer.id}`}>{t("counterNote")}</Label>
            <Textarea
              id={`counter-note-${offer.id}`}
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("roundsLeft", { count: roundsLeft })}
          </p>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {canPropose && (
          <Button
            variant={offer.proposedAt ? "ghost" : "outline"}
            size="sm"
            disabled={propose.isPending}
            onClick={() =>
              propose.mutate({ offerId: offer.id, propose: !offer.proposedAt })
            }
          >
            <BadgeCheck className="h-4 w-4" aria-hidden />
            {offer.proposedAt ? t("unpropose") : t("propose")}
          </Button>
        )}
        {canCounter && !pendingCounter && roundsLeft > 0 && !open && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <MessageSquareReply className="h-4 w-4" aria-hidden />
            {t("counter")}
          </Button>
        )}
        {open && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!priceValid || counter.isPending}
              onClick={() =>
                counter.mutate(
                  { offerId: offer.id, priceCents: cents!, note: note.trim() || null },
                  {
                    onSuccess: () => {
                      setOpen(false);
                      setPrice("");
                      setNote("");
                    },
                  }
                )
              }
            >
              {t("sendCounter")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
