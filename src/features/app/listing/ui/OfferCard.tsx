"use client";

import { useState } from "react";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { Truck, Clock, Star, BadgeCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { addDays } from "@/lib/offer-slots";
import { parseDayString } from "@/lib/availability-window";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Offer, OfferSlot } from "../types";

interface OfferCardProps {
  offer: Offer;
  budgetCents: number;
  /** Only the job's owner, or an operator on an escalated job, may accept. */
  canAccept: boolean;
  isAccepting: boolean;
  isLowest: boolean;
  onAccept: (offerId: string, slotId?: string) => void;
}

const euros = formatCurrency;

export function OfferCard({
  offer,
  budgetCents,
  canAccept,
  isAccepting,
  isLowest,
  onAccept,
}: OfferCardProps) {
  const t = useTranslations("listing.bid.offerCard");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  // The earliest is pre-selected because it is what the offer already promises:
  // `estimatedPickup` holds it, and accepting without naming a slot books it.
  const [slotId, setSlotId] = useState(offer.slots[0]?.id ?? "");

  // The budget is an expectation, not a cap, so bidding over it is normal and
  // is surfaced rather than treated as an error.
  const overBudget = offer.priceCents > budgetCents;
  const difference = offer.priceCents - budgetCents;

  const pending = offer.status === "pending";
  const choosable = canAccept && pending && offer.slots.length > 1;

  // What clicking accept would actually book. The schedule line has to follow
  // it, or the awarder reads one date and commits to another.
  const booked = offer.slots.find((s) => s.id === slotId) ?? offer.slots[0];

  // From the driver's own `day` string, never from the instant: the instant
  // renders in the *viewer's* timezone, so a 06:00 Paris pickup read from
  // London would name the same day only by luck, and from Réunion would not.
  const dayLabel = (day: string) =>
    format(parseDayString(day), "EEE d MMM", { locale: dateLocale });

  const slotLabel = (slot: OfferSlot) =>
    t("slotLine", { day: dayLabel(slot.day), period: t(`slot.${slot.slot}`) });

  return (
    <Card
      className={cn(
        "p-4 sm:p-5 transition-colors duration-200",
        offer.status === "accepted" && "border-success ring-1 ring-success/30"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={offer.carrier.image ?? undefined} alt="" />
            <AvatarFallback>
              {offer.carrier.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate">{offer.carrier.name}</p>
              {offer.status === "accepted" && (
                <Badge className="bg-success/15 text-success border-success/30">
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  {t("selected")}
                </Badge>
              )}
              {isLowest && pending && (
                <Badge variant="secondary">{t("lowest")}</Badge>
              )}
            </div>

            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              <span className="font-mono">{offer.carrier.rating.toFixed(1)}</span>
            </div>

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Truck className="h-4 w-4 shrink-0" />
                <dd className="truncate">
                  {[offer.vehicle.make, offer.vehicle.model]
                    .filter(Boolean)
                    .join(" ") || offer.vehicle.type.replace(/_/g, " ")}
                </dd>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <dd>
                  {booked
                    ? t("schedule", {
                        pickup: slotLabel(booked),
                        delivery: t("deliveryBy", {
                          day: dayLabel(
                            addDays(booked.day, offer.deliveryLeadDays)
                          ),
                        }),
                      })
                    : t("schedule", {
                        // No slot was proposed — this offer took the job's own
                        // window, so the stored instants are all there is.
                        pickup: format(
                          new Date(offer.estimatedPickup),
                          "d MMM, HH:mm",
                          { locale: dateLocale }
                        ),
                        delivery: format(
                          new Date(offer.estimatedDelivery),
                          "d MMM, HH:mm",
                          { locale: dateLocale }
                        ),
                      })}
                </dd>
              </div>
            </dl>

            {/* Several proposals and nobody here who can book one: the list is
                still worth reading — it is what the carrier committed to. */}
            {offer.slots.length > 1 && !choosable && (
              <div className="mt-3">
                <p className="text-sm font-medium">{t("proposedSlots")}</p>
                <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  {offer.slots.map((slot) => (
                    <li key={slot.id}>{slotLabel(slot)}</li>
                  ))}
                </ul>
              </div>
            )}

            {choosable && (
              <div className="mt-3 space-y-2">
                <Label className="text-sm font-medium">{t("chooseSlot")}</Label>
                <RadioGroup
                  value={slotId}
                  onValueChange={setSlotId}
                  aria-label={t("chooseSlot")}
                >
                  {offer.slots.map((slot) => (
                    <div key={slot.id} className="flex items-center gap-2">
                      <RadioGroupItem
                        value={slot.id}
                        id={`slot-${slot.id}`}
                        disabled={isAccepting}
                      />
                      <Label
                        htmlFor={`slot-${slot.id}`}
                        className="text-sm font-normal"
                      >
                        {slotLabel(slot)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {offer.message && (
              <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
                {offer.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
          <div className="text-right">
            <p className="font-mono text-xl font-semibold tabular-nums">
              {euros(offer.priceCents)}
            </p>
            <p
              className={cn(
                "text-xs font-mono",
                overBudget ? "text-warning" : "text-success"
              )}
            >
              {overBudget ? "+" : ""}
              {t("vsBudget", { amount: euros(difference) })}
            </p>
          </div>

          {canAccept && pending && (
            <Button
              onClick={() => onAccept(offer.id, slotId || undefined)}
              disabled={isAccepting}
              className="shrink-0"
            >
              {isAccepting
                ? t("accepting")
                : choosable
                  ? t("acceptSlot")
                  : t("accept")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
