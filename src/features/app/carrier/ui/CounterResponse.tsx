"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, MessageSquareReply } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { formatCurrency } from "@/lib/currency";
import { NUMERIC_RULES, parseCents } from "@/lib/numeric-input";
import { MAX_OFFER_CENTS, MIN_OFFER_CENTS } from "@/server/dto/offers.dto";
import { useRespondToCounter } from "@/features/app/offers/hooks/useNegotiation";
import type { Offer } from "@/features/app/listing/types";

/**
 * The carrier's side of the negotiation (client_feedback_2026_10_29_spec.md
 * §B6): the client's price, and three answers — take it, keep yours, or
 * answer with another. Also says when Expeditoo recommended this offer (§B1).
 */
export function CounterResponse({ offer }: { offer: Offer }) {
  const t = useTranslations("negotiation");
  const respond = useRespondToCounter();
  const [revising, setRevising] = useState(false);
  const [price, setPrice] = useState("");

  const proposed = offer.proposedAt !== null;
  const counter = offer.counterPriceCents;
  if (!proposed && counter === null) return null;

  const cents = parseCents(price);
  const priceValid =
    cents !== null && cents >= MIN_OFFER_CENTS && cents <= MAX_OFFER_CENTS;

  return (
    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
      {proposed && (
        <p className="flex items-start gap-1.5 text-sm">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          {t("proposedToClient")}
        </p>
      )}
      {counter !== null && (
        <>
          <p className="flex items-start gap-1.5 text-sm font-medium">
            <MessageSquareReply className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            {t("clientOffers", {
              price: formatCurrency(counter),
              yours: formatCurrency(offer.priceCents),
            })}
          </p>
          {offer.counterNote && (
            <p className="text-sm text-muted-foreground">« {offer.counterNote} »</p>
          )}
          {revising && (
            <div className="space-y-1">
              <Label htmlFor={`revise-${offer.id}`}>{t("yourNewPrice")}</Label>
              <NumericInput
                id={`revise-${offer.id}`}
                rules={NUMERIC_RULES.MONEY}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {revising ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setRevising(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  size="sm"
                  disabled={!priceValid || respond.isPending}
                  onClick={() =>
                    respond.mutate({
                      offerId: offer.id,
                      answer: { action: "revise", priceCents: cents! },
                    })
                  }
                >
                  {t("sendNewPrice")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={respond.isPending}
                  onClick={() =>
                    respond.mutate({ offerId: offer.id, answer: { action: "decline" } })
                  }
                >
                  {t("keepMine")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevising(true)}
                >
                  {t("otherPrice")}
                </Button>
                <Button
                  size="sm"
                  disabled={respond.isPending}
                  onClick={() =>
                    respond.mutate({ offerId: offer.id, answer: { action: "accept" } })
                  }
                >
                  {t("acceptClientPrice")}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
